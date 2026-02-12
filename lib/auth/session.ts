import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByFirebaseUid } from "@/lib/db/Users";
import { resolveLoginCallbackUrl } from "@/lib/auth/redirect";

type VerifySessionOptions = {
  defaultReturnTo?: string;
};

/**
 * Verifies if the request has a valid session cookie.
 * used in server components/layouts to protect routes.
 */
export async function verifySession(options: VerifySessionOptions = {}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const headerStore = await headers();
  const defaultReturnTo = options.defaultReturnTo;

  const getReturnTo = () => {
    const url =
      headerStore.get("x-url") ||
      headerStore.get("x-next-url") ||
      headerStore.get("referer");
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      if (url.startsWith("/")) return url;
      return null;
    }
  };

  const redirectToLogin = () => {
    const safeReturn = resolveLoginCallbackUrl({
      headerReturnTo: getReturnTo(),
      defaultReturnTo,
    });
    const target = safeReturn
      ? `/login?callbackUrl=${encodeURIComponent(safeReturn)}`
      : "/login";
    redirect(target);
  };

  if (!sessionCookie) {
    return redirectToLogin();
  }

  try {
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true // Check if revoked
    );

    const user = await getUserByFirebaseUid(decodedToken.uid);

    if (!user) {
      redirectToLogin();
    }

    return user;
  } catch {
    redirectToLogin();
  }
}
