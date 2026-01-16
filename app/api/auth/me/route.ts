import { NextRequest, NextResponse } from "next/server";
import { resolveAvatarUrl } from "@/lib/db/Users";
import { requireAuth } from "@/lib/auth/requireAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ isAuthenticated: false }, { status: auth.status });
  }

  const user = auth.user;

  try {
    return NextResponse.json({
      isAuthenticated: true,
      user: {
        uid: (user.firebase_uid as string) || null,
        email: (user.email as string | null) ?? null,
        displayName: `${(user.first_name as string | null) || ""} ${(user.last_name as string | null) || ""
          }`.trim(),
        firstName: user.first_name as string | null,
        lastName: user.last_name as string | null,
        username: user.username as string | null,
        photoURL: resolveAvatarUrl(user.avatarKey, user.username, user.email),
        role: (user.role as string | null) ?? "USER",
      },
    });
  } catch (error) {
    return NextResponse.json({ isAuthenticated: false }, { status: 401 });
  }
}
