import { assertGmailSenderAlignment } from "@/lib/email/gmailSenderGuard";

type ReservationStatusEmailLineItem = {
  reservationNumber: string;
  showName: string;
  scheduleLabel: string;
  seatNumbers: string[];
  amount: string;
};

type ReservationStatusUpdateEmailPayload = {
  to: string;
  customerName: string;
  targetStatus: "CONFIRMED" | "CANCELLED";
  lineItems: ReservationStatusEmailLineItem[];
};

const toBase64Url = (input: string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const getAccessToken = async () => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth credentials for email sender.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(`Failed to refresh Gmail access token: ${data.error ?? "unknown_error"}`);
  }

  return data.access_token;
};

const buildReservationSummary = (lineItems: ReservationStatusEmailLineItem[]) =>
  lineItems
    .map((item, index) =>
      [
        `${index + 1}. ${item.showName}`,
        `   Reservation No: ${item.reservationNumber}`,
        `   Schedule: ${item.scheduleLabel}`,
        `   Seats: ${item.seatNumbers.join(", ")}`,
        `   Amount: ${item.amount}`,
      ].join("\r\n"),
    )
    .join("\r\n\r\n");

export const sendReservationStatusUpdateEmail = async (
  payload: ReservationStatusUpdateEmailPayload,
) => {
  const sender = process.env.GMAIL_SENDER_EMAIL;

  if (!sender) {
    throw new Error("Missing GMAIL_SENDER_EMAIL.");
  }

  const accessToken = await getAccessToken();
  await assertGmailSenderAlignment(accessToken, sender);

  const isConfirmed = payload.targetStatus === "CONFIRMED";
  const statusLabel = isConfirmed ? "Confirmed" : "Rejected";
  const subject = `Seatwise Reservation ${statusLabel}`;
  const body = [
    `Hi ${payload.customerName},`,
    "",
    isConfirmed
      ? "Your reservation payment has been verified."
      : "Your reservation payment could not be verified and the reservation has been rejected.",
    "",
    "Reservation details:",
    buildReservationSummary(payload.lineItems),
    "",
    isConfirmed
      ? "Your reservation is now confirmed in Seatwise."
      : "If you need help, please contact the organizer or admin team for assistance.",
    "",
    "Thank you,",
    "Seatwise Team",
  ].join("\r\n");

  const raw = toBase64Url(
    [
      `From: Seatwise <${sender}>`,
      `To: ${payload.to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      body,
    ].join("\r\n"),
  );

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!sendRes.ok) {
    const error = await sendRes.text();
    throw new Error(`Failed to send reservation status email: ${error}`);
  }
};
