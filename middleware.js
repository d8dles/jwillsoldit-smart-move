import { next } from '@vercel/functions';

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};

export default async function middleware(request) {
  const requestedUrl = new URL(request.url);
  const { pathname, search } = requestedUrl;

  // The login page must remain public or the redirect would loop.
  if (pathname === '/admin/login.html' || pathname === '/admin/login') {
    return next();
  }

  try {
    const sessionUrl = new URL('/api/admin/session', request.url);
    const sessionResponse = await fetch(sessionUrl, {
      method: 'GET',
      headers: {
        cookie: request.headers.get('cookie') || '',
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    const session = await sessionResponse
      .json()
      .catch(() => ({ authenticated: false }));

    if (!sessionResponse.ok || !session.authenticated) {
      const loginUrl = new URL('/admin/login.html', request.url);
      loginUrl.searchParams.set('next', pathname + search);
      return Response.redirect(loginUrl, 307);
    }

    return next();
  } catch {
    // Fail closed if session verification is unavailable.
    const loginUrl = new URL('/admin/login.html', request.url);
    loginUrl.searchParams.set('next', pathname + search);
    return Response.redirect(loginUrl, 307);
  }
}
