import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByFirebaseUid } from "@/lib/db/Users";
import { resolveLoginCallbackUrl } from "@/lib/auth/redirect";

type VerifyAdminOptions = {
  defaultReturnTo?: string;
};

export async function verifyAdmin(options: VerifyAdminOptions = {}) {
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
      true
    );

    const user = await getUserByFirebaseUid(decodedToken.uid);

    if (!user || user.role !== "ADMIN") {
      redirect("/dashboard");
    }

    return user;
  } catch {
    redirectToLogin();
  }
}
