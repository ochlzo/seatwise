type ReservationEmailPayload = {
  to: string;
  customerName: string;
  showName: string;
  scheduleLabel: string;
  seatNumbers: string[];
  totalAmount: string;
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

export const sendReservationSubmittedEmail = async (payload: ReservationEmailPayload) => {
  const sender = process.env.GMAIL_SENDER_EMAIL;
  if (!sender) {
    throw new Error("Missing GMAIL_SENDER_EMAIL.");
  }

  const accessToken = await getAccessToken();
  const subject = `Seatwise Reservation Received - ${payload.showName}`;
  const body = [
    `Hi ${payload.customerName},`,
    "",
    "We received your reservation request in Seatwise.",
    "",
    `Show: ${payload.showName}`,
    `Schedule: ${payload.scheduleLabel}`,
    `Seats: ${payload.seatNumbers.join(", ")}`,
    `Total: ${payload.totalAmount}`,
    "",
    "Status: UNDER REVIEW / VERIFICATION",
    "",
    "Your reservation will be reviewed by the admin team. You will receive an update after verification.",
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
    throw new Error(`Failed to send reservation email: ${error}`);
  }
};
