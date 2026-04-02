import crypto from "node:crypto";

export type ReservationEmailOtpSession = {
  showScopeId: string;
  ticketId: string;
  guestId: string;
  activeToken: string;
  email: string;
  otpVerified: boolean;
  expiresAt: number;
};

export type ReservationEmailOtpState = {
  otpHash: string;
  attempts: number;
  resendCount: number;
  cooldownUntil: number;
  expiresAt: number;
};

export type BuildReservationEmailOtpStateParams = {
  otpHash: string;
  now: number;
  ttlMinutes: number;
  cooldownSeconds: number;
  existingState?: ReservationEmailOtpState | null;
};

export type ReservationEmailOtpContext = {
  showScopeId: string;
  ticketId: string;
  guestId: string;
  activeToken: string;
  email: string;
};

export const reservationEmailOtpSessionKey = (
  showScopeId: string,
  ticketId: string,
) => `seatwise:reservation_email_otp:session:${showScopeId}:${ticketId}`;

export const reservationEmailOtpStateKey = (
  showScopeId: string,
  ticketId: string,
) => `seatwise:reservation_email_otp:state:${showScopeId}:${ticketId}`;

export const reservationEmailOtpLockKey = (
  showScopeId: string,
  ticketId: string,
) => `seatwise:reservation_email_otp:lock:${showScopeId}:${ticketId}`;

export const reservationEmailOtpArtifactKeys = (
  showScopeId: string,
  ticketId: string,
) => [
  reservationEmailOtpSessionKey(showScopeId, ticketId),
  reservationEmailOtpStateKey(showScopeId, ticketId),
  reservationEmailOtpLockKey(showScopeId, ticketId),
];

export const generateReservationEmailOtp = () =>
  String(crypto.randomInt(100000, 1000000));

export const hashReservationEmailOtp = (otp: string, pepper: string) =>
  crypto.createHash("sha256").update(`${otp}:${pepper}`).digest("hex");

export const verifyReservationEmailOtpHash = (
  otp: string,
  expectedHash: string,
  pepper: string,
) => {
  const hashed = hashReservationEmailOtp(otp, pepper);
  const hashedBuffer = Buffer.from(hashed, "utf8");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  return (
    hashedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(hashedBuffer, expectedBuffer)
  );
};

export const normalizeReservationEmail = (email: string) =>
  email.trim().toLowerCase();

export const isReservationEmailOtpSessionCompatible = (
  session: ReservationEmailOtpSession,
  context: ReservationEmailOtpContext,
) =>
  session.showScopeId === context.showScopeId &&
  session.ticketId === context.ticketId &&
  session.guestId === context.guestId &&
  session.activeToken === context.activeToken &&
  session.email === normalizeReservationEmail(context.email);

export const buildReservationEmailOtpState = ({
  otpHash,
  now,
  ttlMinutes,
  cooldownSeconds,
  existingState,
}: BuildReservationEmailOtpStateParams): ReservationEmailOtpState => ({
  otpHash,
  attempts: 0,
  resendCount: (existingState?.resendCount ?? 0) + 1,
  cooldownUntil: now + cooldownSeconds * 1000,
  expiresAt: now + ttlMinutes * 60 * 1000,
});
