# API reference

Two parts: (1) the **Teamleader Focus** endpoints this app consumes, and (2) this app's own
**internal API routes**.

---

## 1. Teamleader Focus API

- **API base:** `https://api.focus.teamleader.eu`
- **Token endpoint:** `https://focus.teamleader.eu/oauth2/access_token`
- **Auth:** OAuth2. Every request sends `Authorization: Bearer <access_token>`.
- **Calls are POST** with a JSON body, even for "list"/"info" reads.
- **Pagination:** `{"page": {"size": 20, "number": <n>}}`; keep paging until a page returns
  fewer than `size` rows.
- **Rate limiting:** HTTP `429` → wait and retry (the script slept 60s; we honour `Retry-After`
  when present and otherwise back off). We also cap concurrency.

### Token refresh (rotating)

`POST https://focus.teamleader.eu/oauth2/access_token`
(form-encoded: `client_id`, `client_secret`, `refresh_token`, `grant_type=refresh_token`)

Response includes a **new** `access_token` **and a new** `refresh_token`. The old refresh token
is now invalid — persist the new one immediately. See the token-ownership rule in `ARCHITECTURE.md`.

### Endpoints used

| Endpoint | Purpose | Key body fields |
| --- | --- | --- |
| `/deals.list` | Customer lookup (won/open/lost) and won-deal run-time list | `filter.status`, `filter.updated_since`, `include: "lead.customer"`, `page` |
| `/deals.info` | Per-deal detail incl. custom fields + `closed_at` | `id` |
| `/deals.update` | **Write back** run-time / execution date / lead source | `id`, `custom_fields: [{id, value}]` |
| `/quotations.list` | List quotations by status | `filter.status` (`accepted`/`open`/`refused`), `page` |
| `/quotations.info` | Per-quotation detail incl. `grouped_lines` → `line_items` | `id` |

### Custom field IDs (Teamleader)

| Constant | UUID | Meaning |
| --- | --- | --- |
| `CF_DATUM_UITVOERING` | `9a9bf893-522a-0dcc-9b5a-40a50378b4d1` | Execution date |
| `CF_DOORLOOPTIJD` | `b19369b0-a73d-0e27-9954-e7d29878b4d3` | Run time (days) — written back |
| `CF_LEADBRON` | `0bb35cd7-9251-060b-8351-157c21789a0a` | Lead source (array) |

### Response shapes we depend on

- `quotations.list` item: `id`, `name`, `status`, `created_at`, `updated_at`, `deal.id`,
  `total.tax_exclusive.amount`, `total.tax_inclusive.amount`.
- `quotations.info` `data.grouped_lines[].line_items[]`: `description`, `quantity`,
  `total.tax_exclusive.amount`.
- `deals.list` `included.contact[]` / `included.company[]` for names; `data[].lead.customer.id`.
- `deals.info` `data`: `id`, `title`, `closed_at`, `custom_fields[].definition.id` + `.value`.

---

## 2. Internal API routes (this app)

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/sync` | `POST` | `CRON_SECRET` (cron) or session (manual) | Run the full pipeline; write snapshot + meta. Long-running (`maxDuration` raised). |
| `/api/refresh` | `POST` | session cookie | UI "Refresh" button. Kicks off a sync and returns immediately. |
| `/api/snapshot` | `GET` | session cookie | Return the latest computed snapshot + meta for the dashboard. |
| `/api/login` | `POST` | none | Compare password to `DASHBOARD_PASSWORD`; set auth cookie. |
| `/api/logout` | `POST` | session cookie | Clear auth cookie. |

### `/api/sync` behaviour

1. Acquire a lock (avoid overlapping runs) via a meta flag.
2. Refresh token (and persist the rotated refresh token).
3. Fetch + compute (see `DATA-MODEL.md`).
4. Write `snapshot` and `meta` (`{ lastSyncAt, durationMs, counts, status, error? }`).
5. Release lock.

### Snapshot JSON shape (consumed by the UI)

```jsonc
{
  "generatedAt": "2026-06-18T05:00:00.000Z",
  "lookbackDays": 90,
  "weeks": ["2026-W25", "2026-W24", ...],          // descending
  "revenue": {
    "totals": { "acceptedRevenue": 298931.82, "openRevenue": 105253.39,
                "acceptedCount": 68, "openCount": 22, "refusedCount": 0,
                "conversionPct": 100.0, "avgRevenuePerDeal": 4396.06,
                "m2Sold": 5166, "totalMargin": 55922.26, "avgMarginPct": 28.4 },
    "byWeek": { "2026-W25": { "acceptedRevenue": 27266.75, ... }, ... }
  },
  "runTime": {
    "totals": { "avgRunTimeDays": 66.8, "dealsTracked": 43 },
    "byWeek": { "2026-W25": { "avgRunTimeDays": 91, "count": 2 }, ... }
  },
  "leadSources": [ { "name": "Onbekend", "revenue": 136144.28, "count": 26 }, ... ],
  "quotations": [ /* per-quotation rows for the table — see DATA-MODEL.md */ ]
}
```
