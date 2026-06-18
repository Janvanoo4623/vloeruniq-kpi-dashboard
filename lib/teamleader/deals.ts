// Customer lookup + run-time (doorlooptijd) computation and write-back.
// Mirrors buildCustomerLookup, fetchRunTime, and pushRunTimeToTeamleader.
import { apiCall, fetchAllPages, mapLimit } from './client';
import { deriveDateParts } from './dates';
import {
  CF_DATUM_UITVOERING,
  CF_DOORLOOPTIJD,
  CF_LEADBRON,
  FETCH_CONCURRENCY,
  PAGE_SIZE,
} from './constants';
import type { CustomerInfo, RunTimeRow } from '../types';
import type {
  TLAddress,
  TLCompany,
  TLContact,
  TLDealDetail,
  TLDealSummary,
} from './tl-types';

function addressFields(a: TLAddress | null | undefined) {
  return {
    city: a?.city?.trim() || '',
    postalCode: a?.postal_code?.trim() || '',
    country: a?.country?.trim() || '',
  };
}

/**
 * Build dealId -> customer info (name + address), across won/open/lost deals.
 * Mirrors buildCustomerLookup; the side-loaded customer already carries a
 * primary_address, so geography comes for free (no extra calls).
 */
export async function buildCustomerLookup(): Promise<Record<string, CustomerInfo>> {
  const lookup: Record<string, CustomerInfo> = {};
  const statuses: string[][] = [['won'], ['open'], ['lost']];

  for (const status of statuses) {
    let page = 1;
    while (true) {
      const resp = await apiCall<{
        data?: TLDealSummary[];
        included?: { contact?: TLContact[]; company?: TLCompany[] };
      }>('/deals.list', {
        filter: { status },
        include: 'lead.customer',
        page: { size: PAGE_SIZE, number: page },
      });

      const data = resp.data ?? [];
      if (data.length === 0) break;

      const byId: Record<string, CustomerInfo> = {};
      for (const c of resp.included?.contact ?? []) {
        const full = [c.first_name?.trim(), c.last_name?.trim()].filter(Boolean).join(' ');
        byId[c.id] = { name: full || 'Onbekend', ...addressFields(c.primary_address) };
      }
      for (const c of resp.included?.company ?? []) {
        byId[c.id] = { name: c.name || 'Onbekend', ...addressFields(c.primary_address) };
      }

      for (const deal of data) {
        const customerId = deal.lead?.customer?.id;
        if (customerId) {
          lookup[deal.id] = byId[customerId] ?? { name: 'Onbekend', city: '', postalCode: '', country: '' };
        }
      }

      if (data.length < PAGE_SIZE) break;
      page++;
    }
  }

  return lookup;
}

async function fetchAllWonDeals(cutoff: string): Promise<TLDealSummary[]> {
  return fetchAllPages<TLDealSummary>('/deals.list', {
    filter: { status: ['won'], updated_since: `${cutoff}T00:00:00+00:00` },
  });
}

async function fetchDealDetail(id: string): Promise<TLDealDetail | null> {
  const resp = await apiCall<{ data?: TLDealDetail }>('/deals.info', { id });
  return resp.data ?? null;
}

function readCustomFields(deal: TLDealDetail) {
  let datumUitvoering = '';
  let doorlooptijdExisting: unknown = '';
  let leadbronArray: string[] = [];

  for (const field of deal.custom_fields ?? []) {
    const id = field.definition.id;
    if (id === CF_DATUM_UITVOERING) {
      datumUitvoering = (field.value as string) || '';
    } else if (id === CF_DOORLOOPTIJD) {
      doorlooptijdExisting = field.value ?? '';
    } else if (id === CF_LEADBRON) {
      if (Array.isArray(field.value)) leadbronArray = field.value as string[];
    }
  }

  const leadSource = leadbronArray.length > 0 ? leadbronArray.join(', ') : '';
  return { datumUitvoering, doorlooptijdExisting, leadbronArray, leadSource };
}

async function pushRunTimeToTeamleader(
  dealId: string,
  runTimeDays: number,
  datumUitvoering: string,
  leadbronArray: string[],
): Promise<void> {
  await apiCall('/deals.update', {
    id: dealId,
    custom_fields: [
      { id: CF_DOORLOOPTIJD, value: runTimeDays },
      { id: CF_DATUM_UITVOERING, value: datumUitvoering },
      { id: CF_LEADBRON, value: leadbronArray ?? [] },
    ],
  });
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Compute run-time rows for won deals and optionally write `doorlooptijd` back
 * to Teamleader. Write-back happens when a deal is newly tracked (and TL's field
 * was empty) or its execution date changed since `prevExecution`.
 */
export async function fetchRunTime(
  cutoff: string,
  prevExecution: Record<string, string>,
  writeback: boolean,
): Promise<{ rows: RunTimeRow[]; pushed: number }> {
  const wonDeals = await fetchAllWonDeals(cutoff);
  const details = await mapLimit(wonDeals, FETCH_CONCURRENCY, (d) => fetchDealDetail(d.id));

  const rows: RunTimeRow[] = [];
  let pushed = 0;

  for (const deal of details) {
    if (!deal) continue;
    const { datumUitvoering, doorlooptijdExisting, leadbronArray, leadSource } =
      readCustomFields(deal);

    if (!datumUitvoering || !deal.closed_at) continue;

    const closedDate = deal.closed_at.split('T')[0];
    const runTimeDays =
      Math.round((Date.parse(datumUitvoering) - Date.parse(closedDate)) / MS_PER_DAY) + 1;
    if (runTimeDays <= 0) continue;

    const { month, quarter, year } = deriveDateParts(closedDate);
    rows.push({
      dealId: deal.id,
      title: deal.title ?? '',
      dateAccepted: closedDate,
      dateExecution: datumUitvoering,
      runTimeDays,
      leadSource,
      month,
      quarter,
      year,
    });

    if (!writeback) continue;

    const prev = prevExecution[deal.id];
    const isTracked = prev !== undefined;
    const shouldPush = isTracked
      ? prev !== datumUitvoering // execution date changed
      : !doorlooptijdExisting; // new deal, TL field still empty

    if (shouldPush) {
      try {
        await pushRunTimeToTeamleader(deal.id, runTimeDays, datumUitvoering, leadbronArray);
        pushed++;
      } catch {
        // Non-fatal: a failed write-back shouldn't abort the whole sync.
      }
    }
  }

  return { rows, pushed };
}
