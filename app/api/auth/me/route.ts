import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getUserByFirebaseUid, resolveAvatarUrl } from "@/lib/db/Users";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ isAuthenticated: false }, { status: 401 });
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );
    const uid = decodedClaims.uid;

    const user = await getUserByFirebaseUid(uid);

    if (!user) {
      return NextResponse.json({ isAuthenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      isAuthenticated: true,
      user: {
        uid: (user.firebase_uid as string) || uid,
        email: (user.email as string | null) ?? null,
        displayName: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
        firstName: user.first_name as string | null,
        lastName: user.last_name as string | null,
        username: user.username as string | null,
        photoURL: resolveAvatarUrl(user.avatarKey, user.username, user.email),
        role: "ADMIN",
      },
    });
  } catch {
    return NextResponse.json({ isAuthenticated: false }, { status: 401 });
  }
}
