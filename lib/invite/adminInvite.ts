import "server-only";
import crypto from "crypto";
import { redis } from "@/lib/clients/redis";

export type InviteTokenPayload = {
  inviteId: string;
  email: string;
  teamId: string | null;
  targetRole: "TEAM_ADMIN" | "SUPERADMIN";
  exp: number;
};

export type InviteSession = {
  inviteId: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  targetRole: "TEAM_ADMIN" | "SUPERADMIN";
  inviterName: string;
  expiresAt: number;
  otpVerified: boolean;
  consumed: boolean;
};

export type InviteOtpState = {
  otpHash: string;
  attempts: number;
  resendCount: number;
  cooldownUntil: number;
  expiresAt: number;
};

type InviteClaimValidationResult =
  | { ok: true }
  | { ok: false; reason: "missing_claim" | "claim_mismatch" | "claim_taken" };

const INVITE_SECRET = process.env.ADMIN_INVITE_SIGNING_SECRET;
const OTP_PEPPER = process.env.ADMIN_OTP_PEPPER;

if (!INVITE_SECRET) {
  throw new Error("ADMIN_INVITE_SIGNING_SECRET is not configured.");
}
if (!OTP_PEPPER) {
  throw new Error("ADMIN_OTP_PEPPER is not configured.");
}

const readIntEnv = (
  name: string,
  fallback: number,
  options: { min: number; max: number },
) => {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < options.min || parsed > options.max) {
    throw new Error(
      `${name} must be an integer between ${options.min} and ${options.max}. Received: ${raw}`,
    );
  }
  return parsed;
};

export const INVITE_TTL_HOURS = readIntEnv("ADMIN_INVITE_TTL_HOURS", 48, {
  min: 1,
  max: 168,
});
export const OTP_TTL_MINUTES = readIntEnv("ADMIN_OTP_TTL_MINUTES", 10, {
  min: 1,
  max: 30,
});
export const OTP_MAX_ATTEMPTS = readIntEnv("ADMIN_OTP_MAX_ATTEMPTS", 5, {
  min: 1,
  max: 20,
});
export const OTP_RESEND_COOLDOWN_SECONDS = readIntEnv(
  "ADMIN_OTP_RESEND_COOLDOWN_SECONDS",
  60,
  { min: 5, max: 300 },
);
export const OTP_MAX_RESENDS = readIntEnv("ADMIN_OTP_MAX_RESENDS", 5, {
  min: 1,
  max: 20,
});

export const inviteSessionKey = (inviteId: string) => `admin_invite:session:${inviteId}`;
export const inviteOtpKey = (inviteId: string) => `admin_invite:otp:${inviteId}`;
export const inviteEmailLockKey = (email: string) => `admin_invite:email_lock:${email}`;
export const inviteClaimKey = (inviteId: string) => `admin_invite:claim:${inviteId}`;
export const inviteOtpLockKey = (inviteId: string) => `admin_invite:otp_lock:${inviteId}`;

export const INVITE_CLAIM_COOKIE = "admin_invite_claim";

const toBase64Url = (value: Buffer | string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padding), "base64");
};

export const signInviteToken = (payload: InviteTokenPayload) => {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(
    crypto.createHmac("sha256", INVITE_SECRET).update(encodedPayload).digest(),
  );
  return `${encodedPayload}.${signature}`;
};

export const verifyInviteToken = (token: string): InviteTokenPayload => {
  const [encodedPayload, encodedSig] = token.split(".");
  if (!encodedPayload || !encodedSig) {
    throw new Error("Invalid invite token.");
  }

  const expectedSig = crypto
    .createHmac("sha256", INVITE_SECRET)
    .update(encodedPayload)
    .digest();
  const providedSig = fromBase64Url(encodedSig);
  if (
    expectedSig.length !== providedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
  ) {
    throw new Error("Invalid invite token signature.");
  }

  const parsed = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as Partial<InviteTokenPayload>;
  const targetRole =
    parsed.targetRole === "SUPERADMIN" || parsed.targetRole === "TEAM_ADMIN"
      ? parsed.targetRole
      : "TEAM_ADMIN";
  const payload: InviteTokenPayload = {
    inviteId: parsed.inviteId ?? "",
    email: parsed.email ?? "",
    teamId: parsed.teamId ?? null,
    targetRole,
    exp: Number(parsed.exp ?? 0),
  };

  if (!payload.inviteId || !payload.email || !payload.exp) {
    throw new Error("Invite token payload is invalid.");
  }
  if (payload.targetRole === "TEAM_ADMIN" && !payload.teamId) {
    throw new Error("Invite token payload is invalid.");
  }
  if (Date.now() >= payload.exp * 1000) {
    throw new Error("Invite token has expired.");
  }
  return payload;
};

export const hashOtp = (otp: string) =>
  crypto.createHash("sha256").update(`${otp}:${OTP_PEPPER}`).digest("hex");

export const generateOtp = () => String(crypto.randomInt(100000, 1000000));

export const getInviteSession = async (inviteId: string): Promise<InviteSession | null> => {
  const raw = await redis.get(inviteSessionKey(inviteId));
  if (!raw) return null;
  if (typeof raw === "string") {
    return JSON.parse(raw) as InviteSession;
  }
  return raw as InviteSession;
};

export const setInviteSession = async (session: InviteSession) => {
  const ttlSeconds = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000));
  await redis.set(inviteSessionKey(session.inviteId), JSON.stringify(session), {
    ex: ttlSeconds,
  });
};

export const getInviteOtpState = async (inviteId: string): Promise<InviteOtpState | null> => {
  const raw = await redis.get(inviteOtpKey(inviteId));
  if (!raw) return null;
  if (typeof raw === "string") {
    return JSON.parse(raw) as InviteOtpState;
  }
  return raw as InviteOtpState;
};

export const setInviteOtpState = async (inviteId: string, state: InviteOtpState) => {
  const ttlSeconds = Math.max(1, Math.floor((state.expiresAt - Date.now()) / 1000));
  await redis.set(inviteOtpKey(inviteId), JSON.stringify(state), { ex: ttlSeconds });
};

export const doesInviteMatchSession = (payload: InviteTokenPayload, session: InviteSession) => {
  if (payload.email !== session.email) return false;
  if (payload.targetRole !== session.targetRole) return false;

  if (payload.targetRole === "TEAM_ADMIN") {
    return Boolean(payload.teamId && payload.teamId === session.teamId);
  }

  return session.teamId === null;
};

export const parseInviteClaimCookie = (value: string | undefined | null) => {
  if (!value) return null;
  const [inviteId, claimId] = value.split(".");
  if (!inviteId || !claimId) return null;
  return { inviteId, claimId };
};

export const ensureInviteClaim = async (
  inviteId: string,
  expiresAt: number,
  currentCookieValue?: string | null,
): Promise<InviteClaimValidationResult & { claimCookieValue?: string }> => {
  const parsed = parseInviteClaimCookie(currentCookieValue);
  const ttlSeconds = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));

  if (parsed?.inviteId === inviteId) {
    const existingClaim = await redis.get(inviteClaimKey(inviteId));
    if (typeof existingClaim === "string" && existingClaim === parsed.claimId) {
      return { ok: true, claimCookieValue: `${inviteId}.${parsed.claimId}` };
    }
  }

  const newClaimId = crypto.randomUUID();
  const setResult = await redis.set(inviteClaimKey(inviteId), newClaimId, {
    nx: true,
    ex: ttlSeconds,
  });
  if (setResult) {
    return { ok: true, claimCookieValue: `${inviteId}.${newClaimId}` };
  }

  if (!parsed) {
    return { ok: false, reason: "missing_claim" };
  }

  return { ok: false, reason: "claim_taken" };
};

export const clearInviteClaim = async (inviteId: string) => {
  await redis.del(inviteClaimKey(inviteId));
};

export const withInviteOtpLock = async <T>(
  inviteId: string,
  fn: () => Promise<T>,
): Promise<T | null> => {
  const lockId = crypto.randomUUID();
  const key = inviteOtpLockKey(inviteId);
  const acquired = await redis.set(key, lockId, { nx: true, ex: 30 });

  if (!acquired) {
    return null;
  }

  try {
    return await fn();
  } finally {
    try {
      const currentLock = await redis.get(key);
      if (typeof currentLock === "string" && currentLock === lockId) {
        await redis.del(key);
      }
    } catch {
      // Best-effort lock release; key is short-lived.
    }
  }
};
