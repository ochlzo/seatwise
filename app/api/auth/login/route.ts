import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveAvatarUrl } from "@/lib/db/Users";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };

    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const admin = await prisma.admin.findUnique({
      where: { firebase_uid: uid },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin account not found. Contact system administrator." },
        { status: 403 },
      );
    }

    const expiresIn = 60 * 60 * 24 * 14 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    const firebaseUser = await adminAuth.getUser(uid);
    const hasPassword = firebaseUser.providerData.some((p) => p.providerId === "password");

    return NextResponse.json({
      user: {
        uid: admin.firebase_uid,
        email: admin.email,
        displayName: `${admin.first_name || ""} ${admin.last_name || ""}`.trim(),
        firstName: admin.first_name,
        lastName: admin.last_name,
        username: admin.username,
        photoURL: resolveAvatarUrl(admin.avatar_key, admin.username, admin.email),
        role: "ADMIN",
        hasPassword,
        isNewUser: false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
