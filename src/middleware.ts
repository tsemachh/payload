import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // 1) Admin guard: if unauthenticated and requesting /admin (or subpaths),
  // strip query params to prevent Payload Admin from restoring problematic state.
  // This runs before other route protections.
  if (pathname.startsWith('/admin')) {
    const hasPayloadToken =
      request.cookies.get('payload-token') != null ||
      request.cookies.getAll().some((c) => c.name.toLowerCase().startsWith('payload-token'))

    if (!hasPayloadToken && search) {
      const url = request.nextUrl.clone()
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Check if the request is for the frontend routes that need protection
  const protectedRoutes = [
    '/account',
    '/meeting',
    '/dashboard',
    '/holdings',
    '/participations',
    '/settings',
  ]
  const isFrontendRoute =
    pathname === '/' || protectedRoutes.some((route) => pathname.startsWith(route))

  // 2) Frontend guard: Skip middleware for non-frontend routes, API routes, and auth routes
  if (
    !isFrontendRoute ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.includes('favicon') ||
    pathname.includes('_next')
  ) {
    return NextResponse.next()
  }

  // Check if the user is authenticated by looking for the payload cookie
  // Payload CMS uses a cookie named 'payload-token' for authentication
  const payloadCookie = request.cookies.get('payload-token')

  // If the user is not authenticated and trying to access a protected route,
  // redirect to the login page
  if (!payloadCookie && isFrontendRoute) {
    const url = new URL('/auth/signin', request.url)
    // Use only pathname and search params to avoid hardcoded hostname issues
    const callbackPath = request.nextUrl.pathname + request.nextUrl.search

    // Only set callbackUrl if it's not the home page
    url.searchParams.set('callbackUrl', encodeURI(callbackPath))

    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
