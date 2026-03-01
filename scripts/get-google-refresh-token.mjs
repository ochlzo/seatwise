#!/usr/bin/env node

import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3005/oauth2/callback";
const SCOPES =
  process.env.GOOGLE_OAUTH_SCOPES ||
  "https://www.googleapis.com/auth/gmail.send";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing env vars. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first.",
  );
  process.exit(1);
}

const redirectUrl = new URL(REDIRECT_URI);
const state = crypto.randomBytes(24).toString("hex");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");
authUrl.searchParams.set("state", state);

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url || "/", REDIRECT_URI);

    if (reqUrl.pathname !== redirectUrl.pathname) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const returnedState = reqUrl.searchParams.get("state");
    const code = reqUrl.searchParams.get("code");
    const error = reqUrl.searchParams.get("error");

    if (error) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`OAuth error: ${error}`);
      console.error(`OAuth error: ${error}`);
      shutdown(1);
      return;
    }

    if (!code || !returnedState || returnedState !== state) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Invalid OAuth callback.");
      console.error("Invalid callback (missing code or state mismatch).");
      shutdown(1);
      return;
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Token exchange failed. Check terminal logs.");
      console.error("Token exchange failed:", tokenJson);
      shutdown(1);
      return;
    }

    const refreshToken = tokenJson.refresh_token;
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("OAuth complete. You can close this tab.");

    if (!refreshToken) {
      console.error(
        "No refresh_token returned. Revoke app access and retry with prompt=consent.",
      );
      console.log("Full token response:", tokenJson);
      shutdown(1);
      return;
    }

    console.log("\nRefresh token:");
    console.log(refreshToken);
    console.log("\nSuggested .env entries:");
    console.log(`GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`);
    console.log("GOOGLE_OAUTH_CLIENT_SECRET=<your-secret>");
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`);
    console.log(`GOOGLE_OAUTH_REDIRECT_URI=${REDIRECT_URI}`);
    shutdown(0);
  } catch (err) {
    console.error("Unexpected error:", err);
    shutdown(1);
  }
});

server.listen(Number(redirectUrl.port || 80), redirectUrl.hostname, () => {
  console.log("Google OAuth refresh token helper");
  console.log(`Listening on ${REDIRECT_URI}`);
  console.log("\nOpen this URL in your browser:");
  console.log(authUrl.toString());
  console.log(
    "\nEnsure this redirect URI is in Google Cloud OAuth client settings:",
  );
  console.log(REDIRECT_URI);
});

function shutdown(code) {
  server.close(() => process.exit(code));
}
