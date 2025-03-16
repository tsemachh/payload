import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the request is for the frontend routes that need protection
  const protectedRoutes = [
    "/account",
    "/assembly",
    "/dashboard",
    "/holdings",
    "/participations"
  ];
  const isFrontendRoute = pathname === "/" || protectedRoutes.some(route => pathname.startsWith(route));

  // Skip middleware for non-frontend routes, API routes, and auth routes
  if (
    !isFrontendRoute ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.includes("favicon") ||
    pathname.includes("_next")
  ) {
    return NextResponse.next();
  }

  // Check if the user is authenticated by looking for the payload cookie
  // Payload CMS uses a cookie named 'payload-token' for authentication
  const payloadCookie = request.cookies.get("payload-token");

  // If the user is not authenticated and trying to access a protected route,
  // redirect to the login page
  if (!payloadCookie && isFrontendRoute) {
    const url = new URL("/auth/signin", request.url);
    // Use only pathname and search params to avoid hardcoded hostname issues
    const callbackPath = request.nextUrl.pathname + request.nextUrl.search;
    url.searchParams.set("callbackUrl", encodeURI(callbackPath));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
