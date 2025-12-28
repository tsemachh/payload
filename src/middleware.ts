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
    '/vote-meeting',
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
  const payloadCookie = request.cookies.get('payload-token')
  // If no cookie at all, redirect to login
  if (!payloadCookie || !payloadCookie.value) {
    const url = new URL('/auth/signin', request.url)
    const callbackPath = request.nextUrl.pathname + request.nextUrl.search
    url.searchParams.set('callbackUrl', encodeURI(callbackPath))
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}