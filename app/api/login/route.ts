// POST /api/login — compare a password to DASHBOARD_PASSWORD and set the auth cookie.
import { NextResponse } from 'next/server';
import { AUTH_COOKIE, createToken } from '@/lib/auth-cookie';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };

  const expected = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!expected || !secret) {
    return NextResponse.json(
      { ok: false, error: 'Server auth is not configured.' },
      { status: 500 },
    );
  }

  if (!password || password !== expected) {
    return NextResponse.json({ ok: false, error: 'Onjuist wachtwoord.' }, { status: 401 });
  }

  const token = await createToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
