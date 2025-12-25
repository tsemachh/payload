import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  // Skip middleware for non-frontend routes, API routes, and auth routes
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

  // If no cookie at all, redirect to login
  if (!payloadCookie || !payloadCookie.value) {
    const url = new URL('/auth/signin', request.url)
    const callbackPath = request.nextUrl.pathname + request.nextUrl.search
    url.searchParams.set('callbackUrl', encodeURI(callbackPath))
    return NextResponse.redirect(url)
  }

  try {
    const response = await fetch(new URL('/api/users/me', request.url), {
      headers: {
        'Cookie': `payload-token=${payloadCookie.value}`,
      },
    })

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      const url = new URL('/auth/signin', request.url)
      const callbackPath = request.nextUrl.pathname + request.nextUrl.search
      url.searchParams.set('callbackUrl', encodeURI(callbackPath))
      
      const redirectResponse = NextResponse.redirect(url)
      redirectResponse.cookies.set('payload-token', '', { 
        expires: new Date(0),
        path: '/' 
      })
      
      return redirectResponse
    }
  } catch (error) {
    console.warn('Middleware: Failed to validate token, letting client handle it')
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
