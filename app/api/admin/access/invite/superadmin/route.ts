import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { sendAdminInviteEmail } from "@/lib/email/sendAdminInviteEmail";
import { randomUUID } from "crypto";
import {
  INVITE_TTL_HOURS,
  InviteSession,
  setInviteSession,
  signInviteToken,
} from "@/lib/invite/adminInvite";

export async function POST(request: NextRequest) {
  try {
    const adminContext = await getCurrentAdminContext();
    if (!adminContext.isSuperadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }

    const inviter = await prisma.admin.findUnique({
      where: { firebase_uid: adminContext.firebaseUid },
      select: { first_name: true, last_name: true, email: true },
    });
    if (!inviter) {
      return NextResponse.json({ error: "Inviter not found." }, { status: 403 });
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
      select: { user_id: true, is_superadmin: true, team_id: true },
    });
    if (existingAdmin) {
      if (!existingAdmin.is_superadmin || existingAdmin.team_id) {
        await prisma.admin.update({
          where: { email },
          data: {
            is_superadmin: true,
            team_id: null,
          },
        });
      }

      return NextResponse.json({ success: true, promotedExistingAdmin: true });
    }

    const inviterName =
      `${inviter.first_name ?? ""} ${inviter.last_name ?? ""}`.trim() || inviter.email;
    const inviteId = randomUUID();
    const expiresAt = Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000;
    const inviteSession: InviteSession = {
      inviteId,
      email,
      teamId: null,
      teamName: null,
      targetRole: "SUPERADMIN",
      inviterName,
      expiresAt,
      otpVerified: false,
      consumed: false,
    };
    await setInviteSession(inviteSession);

    const token = signInviteToken({
      inviteId,
      email,
      teamId: null,
      targetRole: "SUPERADMIN",
      exp: Math.floor(expiresAt / 1000),
    });
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const inviteLink = `${appUrl}/login?invite=${encodeURIComponent(token)}`;

    await sendAdminInviteEmail({
      to: email,
      teamName: null,
      inviterName,
      inviteLink,
      targetRole: "SUPERADMIN",
    });

    return NextResponse.json({ success: true, promotedExistingAdmin: false });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/access/invite/superadmin][POST] Error:", error);
    return NextResponse.json({ error: "Failed to send superadmin invite." }, { status: 500 });
  }
}
