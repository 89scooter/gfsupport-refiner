import { NextResponse } from 'next/server';

export function middleware(req) {
  const session = req.cookies.get('gf_refiner_session');

  const isLoginPage = req.nextUrl.pathname === '/login.html';

  // already logged in
  if (session?.value === process.env.ACCESS_CODE) {
    return NextResponse.next();
  }

  // allow login page
  if (isLoginPage) {
    return NextResponse.next();
  }

  // redirect to login
  return NextResponse.redirect(new URL('/login.html', req.url));
}

export const config = {
  matcher: ['/', '/index.html']
};
