import { auth } from '@/lib/auth';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/login') ||
                     req.nextUrl.pathname.startsWith('/register');
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/workout') ||
                           req.nextUrl.pathname.startsWith('/exercises') ||
                           req.nextUrl.pathname.startsWith('/calendar') ||
                           req.nextUrl.pathname.startsWith('/progress') ||
                           req.nextUrl.pathname.startsWith('/more') ||
                           req.nextUrl.pathname.startsWith('/settings');

  if (isProtectedRoute && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL('/workout', req.nextUrl));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|manifest).*)'],
};
