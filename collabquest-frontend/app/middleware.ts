// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Check for the token cookie
  const token = request.cookies.get('token')?.value;
  
  // 2. Define where the user is trying to go
  const { pathname } = request.nextUrl;

  // 3. Define paths that need protection (your (working) group routes)
  const protectedPaths = ['/dashboard', '/find-team', '/chat', '/matches', '/profile', '/teams'];
  
  // 4. Check if the current path starts with any protected path
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  // 5. If trying to access protected route without token -> Redirect to Login
  if (isProtected && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 6. (Optional) If logged in and trying to access Login/Signup -> Redirect to Dashboard
  if ((pathname === '/login' || pathname === '/signup') && token) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. api routes (/api/...)
     * 2. static files (_next/static, _next/image, favicon.ico)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};