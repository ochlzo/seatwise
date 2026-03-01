#!/usr/bin/env node

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL;

const recipientArg = process.argv[2];
const subjectArg = process.argv[3];
const bodyArg = process.argv[4];

const recipient = recipientArg || process.env.GMAIL_TEST_TO || SENDER_EMAIL;
const subject = subjectArg || "Seatwise Gmail OAuth Test";
const body =
  bodyArg ||
  "This is a test email sent using Google OAuth refresh token via Gmail API.";

const missing = [
  ["GOOGLE_OAUTH_CLIENT_ID", CLIENT_ID],
  ["GOOGLE_OAUTH_CLIENT_SECRET", CLIENT_SECRET],
  ["GOOGLE_OAUTH_REFRESH_TOKEN", REFRESH_TOKEN],
  ["GMAIL_SENDER_EMAIL", SENDER_EMAIL],
].filter(([, value]) => !value);

if (missing.length > 0) {
  console.error("Missing required env vars:");
  for (const [key] of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

if (!recipient) {
  console.error(
    "Missing recipient. Pass one as argv or set GMAIL_TEST_TO in .env.",
  );
  process.exit(1);
}

async function getAccessToken() {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const tokenJson = await tokenRes.json();

  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(
      `Failed to refresh access token: ${JSON.stringify(tokenJson)}`,
    );
  }

  return tokenJson.access_token;
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawMessage() {
  const message = [
    `From: Seatwise <${SENDER_EMAIL}>`,
    `To: ${recipient}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");

  return toBase64Url(message);
}

async function sendEmail(accessToken) {
  const raw = buildRawMessage();

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to send email: ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  try {
    console.log("Refreshing access token...");
    const accessToken = await getAccessToken();

    console.log(`Sending test email to ${recipient}...`);
    const result = await sendEmail(accessToken);

    console.log("Email sent successfully.");
    console.log(`Message ID: ${result.id}`);
    console.log(`Thread ID: ${result.threadId}`);
  } catch (error) {
    console.error("Email test failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
