type AdminInviteEmailPayload = {
  to: string;
  teamName: string;
  inviterName: string;
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

export const sendAdminInviteEmail = async (payload: AdminInviteEmailPayload) => {
  const sender = process.env.GMAIL_SENDER_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  if (!sender) {
    throw new Error("Missing GMAIL_SENDER_EMAIL.");
  }

  const accessToken = await getAccessToken();
  const subject = `Seatwise Admin Invitation - ${payload.teamName}`;
  const body = [
    `Hi,`,
    "",
    `${payload.inviterName} invited you to join the "${payload.teamName}" admin team in Seatwise.`,
    "",
    "If your account is already provisioned, sign in here:",
    `${appUrl}/login`,
    "",
    "If you do not yet have an admin account, reply to this email or contact your Seatwise superadmin.",
    "",
    "Thanks,",
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
    throw new Error(`Failed to send admin invite email: ${error}`);
  }
};
