import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebaseAdmin";
import { redis } from "@/lib/clients/redis";
import {
  clearInviteClaim,
  doesInviteMatchSession,
  getInviteSession,
  INVITE_CLAIM_COOKIE,
  inviteEmailLockKey,
  inviteClaimKey,
  inviteOtpKey,
  inviteSessionKey,
  parseInviteClaimCookie,
  setInviteSession,
  verifyInviteToken,
} from "@/lib/invite/adminInvite";

type CompleteBody = {
  token?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  password?: string;
};

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const INVITE_UNAVAILABLE_ERROR = "Invite link is invalid or unavailable.";
const COMPLETE_FAILED_ERROR = "Unable to complete onboarding right now.";

export async function POST(request: NextRequest) {
  let createdUid: string | null = null;
  let inviteIdForCleanup: string | null = null;
  let lockKey: string | null = null;

  try {
    const body = (await request.json()) as CompleteBody;
    const token = body.token?.trim();
    const firstName = body.firstName?.trim() ?? "";
    const lastName = body.lastName?.trim() ?? "";
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!token) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
    }
    if (!firstName) {
      return NextResponse.json({ error: "First name is required." }, { status: 400 });
    }
    if (!lastName) {
      return NextResponse.json({ error: "Last name is required." }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }
    if (username.length < 2 || username.length > 20) {
      return NextResponse.json({ error: "Username must be 2-20 characters." }, { status: 400 });
    }
    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        { error: "Password must be at least 8 chars and include letters and numbers." },
        { status: 400 },
      );
    }

    const payload = verifyInviteToken(token);
    inviteIdForCleanup = payload.inviteId;

    const claimCookie = parseInviteClaimCookie(request.cookies.get(INVITE_CLAIM_COOKIE)?.value);
    if (!claimCookie || claimCookie.inviteId !== payload.inviteId) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 403 });
    }
    const currentClaim = await redis.get(inviteClaimKey(payload.inviteId));
    if (typeof currentClaim !== "string" || currentClaim !== claimCookie.claimId) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 403 });
    }

    const session = await getInviteSession(payload.inviteId);
    if (!session) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 410 });
    }
    if (session.consumed) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 410 });
    }
    if (!session.otpVerified) {
      return NextResponse.json({ error: "Verify the OTP before completing onboarding." }, { status: 400 });
    }
    if (!doesInviteMatchSession(payload, session)) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
    }
    if (session.targetRole === "TEAM_ADMIN" && !session.teamId && !session.teamName?.trim()) {
      return NextResponse.json(
        { error: "Invite is missing a team name. Ask your superadmin for a new invite." },
        { status: 400 },
      );
    }

    if (session.targetRole === "TEAM_ADMIN" && session.teamId) {
      const team = await prisma.team.findUnique({
        where: { team_id: session.teamId },
        select: { team_id: true },
      });
      if (!team) {
        return NextResponse.json({ error: "Assigned team no longer exists." }, { status: 404 });
      }
    }

    lockKey = inviteEmailLockKey(session.email);
    const lock = await redis.set(lockKey, "1", { nx: true, ex: 120 });
    if (!lock) {
      return NextResponse.json(
        { error: "This invite is already being completed. Please try again." },
        { status: 409 },
      );
    }

    const existingByEmail = await prisma.admin.findUnique({
      where: { email: session.email },
      select: { user_id: true },
    });
    if (existingByEmail) {
      return NextResponse.json(
        { error: "An admin account with this email already exists." },
        { status: 409 },
      );
    }
    const existingByUsername = await prisma.admin.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      select: { user_id: true },
    });
    if (existingByUsername) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
    }

    await setInviteSession({
      ...session,
      consumed: true,
    });

    const firebaseUser = await adminAuth.createUser({
      email: session.email,
      password,
      displayName: `${firstName} ${lastName}`.trim(),
    });
    createdUid = firebaseUser.uid;

    const createdAdmin = await prisma.$transaction(async (tx) => {
      let resolvedTeamId: string | null = null;

      if (session.targetRole === "TEAM_ADMIN") {
        if (session.teamId) {
          const existingTeam = await tx.team.findUnique({
            where: { team_id: session.teamId },
            select: { team_id: true },
          });
          if (!existingTeam) {
            throw new Error("Assigned team no longer exists.");
          }
          resolvedTeamId = existingTeam.team_id;
        } else {
          const pendingTeamName = session.teamName?.trim();
          if (!pendingTeamName) {
            throw new Error("Invite is missing a team name.");
          }

          const createdTeam = await tx.team.create({
            data: {
              team_id: randomUUID(),
              name: pendingTeamName,
            },
            select: {
              team_id: true,
            },
          });

          resolvedTeamId = createdTeam.team_id;
        }
      }

      const admin = await tx.admin.create({
        data: {
          firebase_uid: firebaseUser.uid,
          username,
          email: session.email,
          first_name: firstName,
          last_name: lastName,
          status: "ACTIVE",
          team_id: session.targetRole === "SUPERADMIN" ? null : resolvedTeamId,
          is_superadmin: session.targetRole === "SUPERADMIN",
        },
        select: {
          user_id: true,
        },
      });

      if (session.targetRole === "TEAM_ADMIN" && resolvedTeamId) {
        await tx.team.updateMany({
          where: {
            team_id: resolvedTeamId,
            team_leader_admin_id: null,
          },
          data: {
            team_leader_admin_id: admin.user_id,
          },
        });
      }

      return admin;
    });

    await Promise.all([
      redis.del(inviteSessionKey(session.inviteId)),
      redis.del(inviteOtpKey(session.inviteId)),
      lockKey ? redis.del(lockKey) : Promise.resolve(0),
      clearInviteClaim(session.inviteId),
    ]);

    const response = NextResponse.json({
      success: true,
      email: session.email,
      teamLeaderAssigned: session.targetRole === "TEAM_ADMIN" ? createdAdmin.user_id : null,
    });
    response.cookies.set({
      name: INVITE_CLAIM_COOKIE,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("[admin/access/invite/complete] Error:", error);
    let rollbackSucceeded = false;
    if (createdUid) {
      try {
        await adminAuth.deleteUser(createdUid);
        rollbackSucceeded = true;
      } catch (rollbackError) {
        console.error("[admin/access/invite/complete] Firebase rollback failed:", rollbackError);
      }
    }
    if (inviteIdForCleanup && (!createdUid || rollbackSucceeded)) {
      try {
        const session = await getInviteSession(inviteIdForCleanup);
        if (session) {
          await setInviteSession({ ...session, consumed: false });
        }
      } catch (sessionResetError) {
        console.error("[admin/access/invite/complete] Session reset failed:", sessionResetError);
      }
    }
    if (lockKey) {
      await redis.del(lockKey);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return NextResponse.json(
        { error: "Database schema is out of date. Run Prisma migrations and retry onboarding." },
        { status: 500 },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Team name already exists. Ask your superadmin to send a new invite." },
        { status: 409 },
      );
    }

    const authCode = (error as { code?: string })?.code;
    if (authCode === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "An account with this email already exists. Use a different invite email." },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: COMPLETE_FAILED_ERROR }, { status: 400 });
  }
}
