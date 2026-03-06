import { NextRequest, NextResponse } from "next/server";
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
const COMPLETE_FAILED_ERROR = "Unable to complete onboarding with the provided details.";

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

    if (!token || !firstName || !lastName || !username || !password) {
      return NextResponse.json({ error: COMPLETE_FAILED_ERROR }, { status: 400 });
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
      return NextResponse.json({ error: COMPLETE_FAILED_ERROR }, { status: 400 });
    }
    if (!doesInviteMatchSession(payload, session)) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
    }
    if (session.targetRole === "TEAM_ADMIN") {
      const team = await prisma.team.findUnique({
        where: { team_id: session.teamId! },
        select: { team_id: true },
      });
      if (!team) {
        return NextResponse.json({ error: COMPLETE_FAILED_ERROR }, { status: 404 });
      }
    }

    lockKey = inviteEmailLockKey(session.email);
    const lock = await redis.set(lockKey, "1", { nx: true, ex: 120 });
    if (!lock) {
      return NextResponse.json(
        { error: COMPLETE_FAILED_ERROR },
        { status: 409 },
      );
    }

    const existingByEmail = await prisma.admin.findUnique({
      where: { email: session.email },
      select: { user_id: true },
    });
    if (existingByEmail) {
      return NextResponse.json(
        { error: COMPLETE_FAILED_ERROR },
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
      return NextResponse.json({ error: COMPLETE_FAILED_ERROR }, { status: 409 });
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

    await prisma.admin.create({
      data: {
        firebase_uid: firebaseUser.uid,
        username,
        email: session.email,
        first_name: firstName,
        last_name: lastName,
        status: "ACTIVE",
        team_id: session.targetRole === "SUPERADMIN" ? null : session.teamId,
        is_superadmin: session.targetRole === "SUPERADMIN",
      },
    });

    await Promise.all([
      redis.del(inviteSessionKey(session.inviteId)),
      redis.del(inviteOtpKey(session.inviteId)),
      lockKey ? redis.del(lockKey) : Promise.resolve(0),
      clearInviteClaim(session.inviteId),
    ]);

    const response = NextResponse.json({ success: true, email: session.email });
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

    return NextResponse.json({ error: COMPLETE_FAILED_ERROR }, { status: 400 });
  }
}
