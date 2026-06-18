// Teamleader API client: POST-JSON calls with 401 token-retry, 429 backoff,
// pagination, and a bounded-concurrency helper. Mirrors the Apps Script's
// apiCall + paging loops.
import { getAccessToken, invalidateAccessToken } from './auth';
import { API_BASE, PAGE_SIZE } from './constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ApiCallOptions {
  attempt?: number;
  maxAttempts?: number;
}

/** POST a JSON body to a Teamleader endpoint and return the parsed response. */
export async function apiCall<T = unknown>(
  endpoint: string,
  body: unknown,
  { attempt = 0, maxAttempts = 4 }: ApiCallOptions = {},
): Promise<T> {
  const accessToken = await getAccessToken();

  const res = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  // Rate limited — honour Retry-After, otherwise back off, then retry.
  if (res.status === 429 && attempt < maxAttempts) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60_000;
    await sleep(waitMs);
    return apiCall<T>(endpoint, body, { attempt: attempt + 1, maxAttempts });
  }

  // Access token expired mid-run — refresh once and retry.
  if (res.status === 401 && attempt < 1) {
    await invalidateAccessToken();
    return apiCall<T>(endpoint, body, { attempt: attempt + 1, maxAttempts });
  }

  if (res.status === 204) return {} as T;

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Teamleader ${endpoint} -> ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

interface ListResponse<T> {
  data?: T[];
  included?: Record<string, unknown[]>;
}

/**
 * Page through a Teamleader `*.list` endpoint until a short page is returned.
 * `onPage` may return `false` to stop early (used for date-windowed lists).
 */
export async function fetchAllPages<T>(
  endpoint: string,
  baseBody: Record<string, unknown>,
  onPage?: (page: ListResponse<T>, pageNumber: number) => boolean | void,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;

  while (true) {
    const resp = await apiCall<ListResponse<T>>(endpoint, {
      ...baseBody,
      page: { size: pageSize, number: page },
    });
    const data = resp.data ?? [];
    all.push(...data);

    const keepGoing = onPage ? onPage(resp, page) : true;
    if (keepGoing === false || data.length < pageSize) break;
    page++;
  }

  return all;
}

/** Run `fn` over `items` with at most `limit` concurrent executions, preserving order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) break;
      results[index] = await fn(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
