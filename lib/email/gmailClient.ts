import { assertGmailSenderAlignment } from "@/lib/email/gmailSenderGuard";

const toBase64Url = (input: string | Buffer) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const encodeGmailRawMessage = (input: string | Buffer) => toBase64Url(input);

export const getGmailAccessToken = async () => {
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

export const getGmailSender = () => {
  const sender = process.env.GMAIL_SENDER_EMAIL;
  if (!sender) {
    throw new Error("Missing GMAIL_SENDER_EMAIL.");
  }

  return sender;
};

export const sendGmailRawMessage = async (raw: string) => {
  const sender = getGmailSender();
  const accessToken = await getGmailAccessToken();
  await assertGmailSenderAlignment(accessToken, sender);

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

  return sender;
};

const inferExtension = (contentType: string) => {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("svg")) return "svg";
  return "jpg";
};

export const fetchRemoteEmailImage = async (url: string, filenamePrefix: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch email image attachment: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const extension = inferExtension(contentType);
  const content = Buffer.from(await response.arrayBuffer());

  return {
    content,
    contentType,
    filename: `${filenamePrefix}.${extension}`,
  };
};
