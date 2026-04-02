export type ReservationStep = "seats" | "contact" | "email_otp" | "ticket_design" | "payment";

export const DEFAULT_QUEUE_PRESENCE_TTL_SECONDS = 30;
export const OTP_QUEUE_PRESENCE_TTL_SECONDS = 120;

export function getQueuePresenceTtlSeconds(
  reservationStep?: ReservationStep | null,
): number {
  return reservationStep === "email_otp"
    ? OTP_QUEUE_PRESENCE_TTL_SECONDS
    : DEFAULT_QUEUE_PRESENCE_TTL_SECONDS;
}
