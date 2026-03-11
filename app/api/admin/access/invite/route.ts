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
    const body = (await request.json()) as { teamId?: string; email?: string };
    const teamId = body.teamId?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required." }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }

    if (!adminContext.isSuperadmin && adminContext.teamId !== teamId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [team, inviter] = await Promise.all([
      prisma.team.findUnique({
        where: { team_id: teamId },
        select: { name: true },
      }),
      prisma.admin.findUnique({
        where: { firebase_uid: adminContext.firebaseUid },
        select: { first_name: true, last_name: true, email: true },
      }),
    ]);

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }
    if (!inviter) {
      return NextResponse.json({ error: "Inviter not found." }, { status: 403 });
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
      select: { user_id: true },
    });
    if (existingAdmin) {
      return NextResponse.json({ success: true });
    }

    const inviterName =
      `${inviter.first_name ?? ""} ${inviter.last_name ?? ""}`.trim() || inviter.email;
    const inviteId = randomUUID();
    const expiresAt = Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000;
    const inviteSession: InviteSession = {
      inviteId,
      email,
      teamId,
      teamName: team.name,
      targetRole: "TEAM_ADMIN",
      inviterName,
      expiresAt,
      otpVerified: false,
      consumed: false,
    };
    await setInviteSession(inviteSession);
    const token = signInviteToken({
      inviteId,
      email,
      teamId,
      targetRole: "TEAM_ADMIN",
      exp: Math.floor(expiresAt / 1000),
    });
    const appUrl =
      process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
      request.nextUrl.origin ||
      "http://localhost:3000";
    const inviteLink = `${appUrl}/login?invite=${encodeURIComponent(token)}`;

    await sendAdminInviteEmail({
      to: email,
      teamName: team.name,
      inviterName,
      inviteLink,
      targetRole: "TEAM_ADMIN",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/access/invite][POST] Error:", error);
    return NextResponse.json({ error: "Failed to send invite." }, { status: 500 });
  }
}
