// Teamleader OAuth token handling with ROTATING refresh tokens.
//
// CRITICAL: Teamleader returns a new refresh token on every refresh and
// invalidates the previous one. We must (a) persist the rotated token
// immediately, and (b) never run two refreshes concurrently (a race would
// rotate the token twice and invalidate the one we just stored). All callers
// funnel through getAccessToken(), which serializes via a single in-flight
// promise. See docs/ARCHITECTURE.md "THE TOKEN-OWNERSHIP RULE".
import { getToken, setToken } from '../db';
import type { TokenState } from '../types';
import { TOKEN_URL } from './constants';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/** Load the token from the store, seeding from env on first run. */
async function loadToken(): Promise<TokenState> {
  const stored = await getToken();
  if (stored?.refreshToken) return stored;

  const seed = process.env.TEAMLEADER_REFRESH_TOKEN;
  if (!seed) {
    throw new Error(
      'No Teamleader refresh token available. Seed one via the datastore or the ' +
        'TEAMLEADER_REFRESH_TOKEN env var (see docs/DEPLOYMENT.md).',
    );
  }
  const seeded: TokenState = { refreshToken: seed };
  await setToken(seeded);
  return seeded;
}

/** Perform the actual refresh, persisting the rotated refresh token at once. */
async function doRefresh(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: required('TEAMLEADER_CLIENT_ID'),
    client_secret: required('TEAMLEADER_CLIENT_SECRET'),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!res.ok || data.error || !data.access_token) {
    throw new Error(`Teamleader token refresh failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  await setToken({
    refreshToken: data.refresh_token ?? refreshToken, // persist the rotated token NOW
    accessToken: data.access_token,
    accessTokenExpiresAt: Date.now() + expiresIn * 1000,
  });

  return data.access_token;
}

// Single in-flight promise serializes all token work across concurrent callers.
let inflight: Promise<string> | null = null;

async function resolveAccessToken(): Promise<string> {
  const token = await loadToken();
  const valid =
    token.accessToken &&
    token.accessTokenExpiresAt &&
    token.accessTokenExpiresAt - Date.now() > 60_000;
  if (valid) return token.accessToken as string;
  return doRefresh(token.refreshToken);
}

/** Get a valid access token, refreshing (once, serialized) if needed. */
export function getAccessToken(): Promise<string> {
  if (inflight) return inflight;
  inflight = resolveAccessToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Force a refresh on the next getAccessToken (used after a 401). Serialized. */
export async function invalidateAccessToken(): Promise<void> {
  if (inflight) {
    // A refresh is already happening; let it complete.
    await inflight.catch(() => {});
    return;
  }
  const token = await getToken();
  if (token) {
    await setToken({ ...token, accessToken: undefined, accessTokenExpiresAt: 0 });
  }
}
