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

export async function GET(request: NextRequest) {
  try {
    const adminContext = await getCurrentAdminContext();
    const teamId = request.nextUrl.searchParams.get("teamId")?.trim();
    const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();

    if (!teamId || !email) {
      return NextResponse.json({ error: "teamId and email are required." }, { status: 400 });
    }

    if (!adminContext.isSuperadmin && adminContext.teamId !== teamId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
      select: { team_id: true, is_superadmin: true },
    });

    if (!existingAdmin) {
      return NextResponse.json({ exists: false });
    }

    if (existingAdmin.team_id === teamId) {
      return NextResponse.json({ exists: true, isTeamMember: true });
    }

    return NextResponse.json({ exists: true, isTeamMember: false });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/access/invite][GET] Error:", error);
    return NextResponse.json({ error: "Failed to check admin status." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminContext = await getCurrentAdminContext();
    const body = (await request.json()) as {
      teamId?: string;
      teamName?: string;
      email?: string;
    };
    const teamId = body.teamId?.trim();
    const teamName = body.teamName?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }
    if (!teamId && !teamName) {
      return NextResponse.json({ error: "teamId or teamName is required." }, { status: 400 });
    }
    if (teamId && teamName) {
      return NextResponse.json(
        { error: "Provide either teamId or teamName, but not both." },
        { status: 400 },
      );
    }

    if (teamName && !adminContext.isSuperadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (teamId && !adminContext.isSuperadmin && adminContext.teamId !== teamId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedTeam = teamId
      ? await prisma.team.findUnique({
          where: { team_id: teamId },
          select: {
            team_id: true,
            name: true,
          },
        })
      : await prisma.team.findFirst({
          where: {
            name: {
              equals: teamName!,
              mode: "insensitive",
            },
          },
          select: {
            team_id: true,
            name: true,
          },
        });

    const inviter = await prisma.admin.findUnique({
        where: { firebase_uid: adminContext.firebaseUid },
        select: { first_name: true, last_name: true, email: true },
      });

    if (teamId && !resolvedTeam) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }
    if (teamName && resolvedTeam) {
      return NextResponse.json(
        { error: "A team with that name already exists." },
        { status: 409 },
      );
    }
    if (!inviter) {
      return NextResponse.json({ error: "Inviter not found." }, { status: 403 });
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
      select: {
        user_id: true,
        team_id: true,
        is_superadmin: true,
        team: {
          select: {
            name: true,
          },
        },
      },
    });
    if (existingAdmin) {
      if (existingAdmin.team_id === teamId) {
        return NextResponse.json(
          { error: "This email is already a member of this team." },
          { status: 409 },
        );
      }

      if (existingAdmin.is_superadmin) {
        return NextResponse.json(
          { error: "This email already belongs to a superadmin account." },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: existingAdmin.team?.name
            ? `This email is already assigned to admin team \"${existingAdmin.team.name}\".`
            : "This email is already assigned to an admin account.",
        },
        { status: 409 },
      );
    }

    const inviterName =
      `${inviter.first_name ?? ""} ${inviter.last_name ?? ""}`.trim() || inviter.email;
    const inviteId = randomUUID();
    const expiresAt = Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000;
    const inviteSession: InviteSession = {
      inviteId,
      email,
      teamId: teamId ?? null,
      teamName: teamName ?? resolvedTeam?.name ?? null,
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
      teamId: teamId ?? null,
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
      teamName: teamName ?? resolvedTeam?.name ?? null,
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
