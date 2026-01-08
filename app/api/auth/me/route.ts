import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getUserByFirebaseUid } from "@/lib/db/Users";

export async function GET(req: NextRequest) {
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
        displayName: `${(user.first_name as string | null) || ""} ${
          (user.last_name as string | null) || ""
        }`.trim(),
        role: (user.role as string | null) ?? "USER",
      },
    });
  } catch (error) {
    return NextResponse.json({ isAuthenticated: false }, { status: 401 });
  }
}
