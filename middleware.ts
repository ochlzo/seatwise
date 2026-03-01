import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set<string>([
  "/",
  "/dashboard",
  "/all-events",
  "/privacy-policy",
  "/terms-of-service",
]);

const isAdminPath = (pathname: string) => {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/seat-builder")
  );
};

const isAdminApiPath = (pathname: string) => {
  return (
    pathname === "/api/auth/me" ||
    pathname === "/api/auth/logout" ||
    pathname.startsWith("/api/reservations") ||
    pathname.startsWith("/api/seatmaps") ||
    pathname.startsWith("/api/seatCategories") ||
    pathname.startsWith("/api/uploads/cloudinary/sign")
  );
};

const isPublicApiPath = (pathname: string) => {
  return pathname === "/api/auth/login" || pathname === "/api/auth/admin-email";
};

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isNextAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml");

  const isApi = pathname.startsWith("/api");

  if (isNextAsset || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (isApi && !isAdminApiPath(pathname)) {
    return NextResponse.next();
  }

  if (isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAdminPath(pathname) && !isAdminApiPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get("session")?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const callbackUrl = `${pathname}${search}`;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
