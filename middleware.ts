import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set<string>(["/", "/login"]);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isNextAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml");

  const isApi = pathname.startsWith("/api");

  if (isNextAsset || isApi || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get("session")?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  const callbackUrl = `${pathname}${search}`;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};

