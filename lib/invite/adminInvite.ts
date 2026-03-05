import "server-only";
import crypto from "crypto";
import { redis } from "@/lib/clients/redis";

export type InviteTokenPayload = {
  inviteId: string;
  email: string;
  teamId: string;
  exp: number;
};

export type InviteSession = {
  inviteId: string;
  email: string;
  teamId: string;
  teamName: string;
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

const INVITE_SECRET = process.env.ADMIN_INVITE_SIGNING_SECRET;
const OTP_PEPPER = process.env.ADMIN_OTP_PEPPER;

if (!INVITE_SECRET) {
  throw new Error("ADMIN_INVITE_SIGNING_SECRET is not configured.");
}
if (!OTP_PEPPER) {
  throw new Error("ADMIN_OTP_PEPPER is not configured.");
}

export const INVITE_TTL_HOURS = Number(process.env.ADMIN_INVITE_TTL_HOURS ?? "48");
export const OTP_TTL_MINUTES = Number(process.env.ADMIN_OTP_TTL_MINUTES ?? "10");
export const OTP_MAX_ATTEMPTS = Number(process.env.ADMIN_OTP_MAX_ATTEMPTS ?? "5");
export const OTP_RESEND_COOLDOWN_SECONDS = Number(
  process.env.ADMIN_OTP_RESEND_COOLDOWN_SECONDS ?? "60",
);
export const OTP_MAX_RESENDS = Number(process.env.ADMIN_OTP_MAX_RESENDS ?? "5");

export const inviteSessionKey = (inviteId: string) => `admin_invite:session:${inviteId}`;
export const inviteOtpKey = (inviteId: string) => `admin_invite:otp:${inviteId}`;
export const inviteEmailLockKey = (email: string) => `admin_invite:email_lock:${email}`;

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

  const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as InviteTokenPayload;
  if (!payload.inviteId || !payload.email || !payload.teamId || !payload.exp) {
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

