export function getReservationEmailOtpInlineError(
  status: number,
  error?: string | null,
): string | null {
  if (status === 400 && error === "Invalid verification code.") {
    return error;
  }

  if (status === 410 && error === "Verification code expired. Request a new code.") {
    return error;
  }

  return null;
}
