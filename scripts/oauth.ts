// One-time Teamleader re-authorization to mint a fresh refresh token and store
// it in Supabase. Run: `npm run oauth`, then open the printed URL, approve, and
// Teamleader redirects back to localhost where we capture the code.
//
// PREREQUISITE: the redirect URI below must be registered on the Teamleader
// integration (Marketplace → your integration → Redirect URIs).
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import http from 'node:http';
import { setToken } from '../lib/db';

const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/callback`;
const AUTH_URL = 'https://focus.teamleader.eu/oauth2/authorize';
const TOKEN_URL = 'https://focus.teamleader.eu/oauth2/access_token';

const CLIENT_ID = process.env.TEAMLEADER_CLIENT_ID;
const CLIENT_SECRET = process.env.TEAMLEADER_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing TEAMLEADER_CLIENT_ID / TEAMLEADER_CLIENT_SECRET in .env.local');
  process.exit(1);
}

async function exchange(code: string) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data as { access_token: string; refresh_token: string; expires_in?: number };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT);
  if (!url.pathname.startsWith('/callback')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (err) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>Autorisatie geweigerd: ${err}</h1>`);
    console.error('Authorization error:', err);
    return;
  }
  if (!code) {
    res.writeHead(400);
    res.end('no code');
    return;
  }
  try {
    const data = await exchange(code);
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    await setToken({
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
      accessTokenExpiresAt: Date.now() + expiresIn * 1000,
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Gelukt! Nieuwe token opgeslagen in Supabase. Je kunt dit tabblad sluiten.</h1>');
    console.log(`\n✓ Verse token opgeslagen in Supabase (refresh_token len ${data.refresh_token.length}).`);
    console.log('Je kunt dit script nu sluiten (Ctrl+C) en `npm run sync` draaien.');
    setTimeout(() => process.exit(0), 500);
  } catch (e) {
    res.writeHead(500);
    res.end(`error: ${(e as Error).message}`);
    console.error('EXCHANGE FAILED:', (e as Error).message);
  }
});

server.listen(PORT, () => {
  const authUrl =
    `${AUTH_URL}?client_id=${encodeURIComponent(CLIENT_ID!)}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT)}&state=vloeruniq`;
  console.log('\n=== Teamleader re-autorisatie ===');
  console.log(`\n1) Registreer deze redirect URI in de Teamleader-integratie (indien nog niet):\n   ${REDIRECT}`);
  console.log(`\n2) Open deze URL in je browser, log in en keur goed:\n\n${authUrl}\n`);
  console.log(`Wachten op redirect naar localhost:${PORT} …`);
});
