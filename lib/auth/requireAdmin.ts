import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getUserByFirebaseUid } from "@/lib/db/Users";

export async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  try {
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );
    const user = await getUserByFirebaseUid(decodedToken.uid);

    if (!user) {
      return { ok: false as const, status: 401, error: "Unauthorized" };
    }

    if (user.role !== "ADMIN") {
      return { ok: false as const, status: 403, error: "Forbidden" };
    }

    return { ok: true as const, user };
  } catch {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
}
