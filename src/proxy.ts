import { NextResponse, type NextRequest } from 'next/server';

const IS_DEV = process.env.NODE_ENV === 'development';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function securityHeaders(res: NextResponse, csp?: string, https = false) {
  if (csp) res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  if (https) res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  return res;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const https = (request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')) === 'https';

  // ---- API：擋掉跨站請求（CSRF）----
  if (pathname.startsWith('/api/')) {
    if (!SAFE_METHODS.has(request.method)) {
      const origin = request.headers.get('origin');
      const site = request.headers.get('sec-fetch-site');
      const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
      let sameOrigin = false;
      try {
        sameOrigin = !!origin && !!host && new URL(origin).host === host;
      } catch {
        sameOrigin = false;
      }
      if (!sameOrigin || (site && site !== 'same-origin')) {
        return securityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
      }
    }
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return securityHeaders(res, "default-src 'none'; frame-ancestors 'none'", https);
  }

  // ---- 頁面：每次請求產生新的 nonce，只允許帶這個 nonce 的 script 執行 ----
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? " 'unsafe-eval'" : ''}`,
    `style-src 'self'${IS_DEV ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  requestHeaders.set('x-pathname', pathname);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (pathname.startsWith('/manage') || pathname.startsWith('/login') || pathname.startsWith('/setup')) {
    res.headers.set('Cache-Control', 'no-store, max-age=0');
  }
  return securityHeaders(res, csp, https);
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
