// Password gate (Next 16's renamed middleware). Lightweight cookie check only —
// no data fetching (per the Next docs). See docs/ARCHITECTURE.md "Auth".
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, verifyToken } from './lib/auth-cookie';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths: the login page/API, and the cron sync (which self-protects
  // with CRON_SECRET and is called without a session cookie).
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/sync')
  ) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_COOKIE_SECRET ?? '';
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!(await verifyToken(token, secret))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
