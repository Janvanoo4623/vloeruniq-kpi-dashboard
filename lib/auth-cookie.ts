// HMAC-signed auth cookie for the shared-password gate. Uses Web Crypto so it
// works in both the Node and Edge runtimes (proxy.ts may run on Edge).

export const AUTH_COOKIE = 'vu_auth';
const TOKEN_VERSION = 'v1';
const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toB64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = '';
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const str = atob(padded);
  const buffer = new ArrayBuffer(str.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

/** Create a signed token (payload = version.issuedAt). */
export async function createToken(secret: string): Promise<string> {
  const payload = `${TOKEN_VERSION}.${Date.now()}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${toB64Url(sig)}`;
}

/** Verify a token's signature. */
export async function verifyToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token || !secret) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return false;

  const payload = token.slice(0, lastDot);
  if (!payload.startsWith(`${TOKEN_VERSION}.`)) return false;

  try {
    const key = await hmacKey(secret);
    const sig = fromB64Url(token.slice(lastDot + 1));
    return await crypto.subtle.verify('HMAC', key, sig, encoder.encode(payload));
  } catch {
    return false;
  }
}
