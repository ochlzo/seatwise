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
    const candidates = [
      headerStore.get("x-url"),
      headerStore.get("x-next-url"),
      headerStore.get("next-url"),
      headerStore.get("x-pathname"),
      headerStore.get("x-invoke-path"),
      headerStore.get("referer"),
    ];

    for (const value of candidates) {
      if (!value) continue;
      try {
        const parsed = new URL(value);
        return `${parsed.pathname}${parsed.search}`;
      } catch {
        if (value.startsWith("/")) {
          return value;
        }
      }
    }

    return null;
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
