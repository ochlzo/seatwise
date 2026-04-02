import { encodeGmailRawMessage, sendGmailRawMessage } from "@/lib/email/gmailClient";

type SendReservationEmailOtpPayload = {
  to: string;
  showName: string;
  otp: string;
};

export const sendReservationEmailOtpEmail = async ({
  to,
  showName,
  otp,
}: SendReservationEmailOtpPayload) => {
  const sender = process.env.GMAIL_SENDER_EMAIL;
  if (!sender) {
    throw new Error("Missing GMAIL_SENDER_EMAIL.");
  }

  const subject = `Seatwise Email Verification Code - ${showName}`;
  const body = [
    "Hi,",
    "",
    `Your Seatwise reservation verification code is: ${otp}`,
    "",
    "This code expires in 10 minutes.",
    "If you did not request this, you can ignore this email.",
    "",
    "Thanks,",
    "Seatwise Team",
  ].join("\r\n");

  const raw = [
    `From: Seatwise <${sender}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");

  await sendGmailRawMessage(encodeGmailRawMessage(raw));
};
