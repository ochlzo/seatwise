export const normalizeEmail = (value: string) => value.trim().toLowerCase();

const parseAllowedAliases = () => {
  const raw = process.env.GMAIL_ALLOWED_SENDER_ALIASES ?? "";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

export const assertGmailSenderAlignment = async (accessToken: string, sender: string) => {
  const normalizedSender = normalizeEmail(sender);
  const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileRes.ok) {
    const detail = await profileRes.text();
    if (detail.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") || detail.includes("insufficientPermissions")) {
      throw new Error(
        "Failed to validate Gmail sender identity: the configured Google OAuth refresh token is missing a Gmail profile-readable scope. Regenerate GOOGLE_OAUTH_REFRESH_TOKEN with at least gmail.send and gmail.readonly, then update the deployed environment.",
      );
    }
    throw new Error(`Failed to validate Gmail sender identity: ${detail}`);
  }

  const profile = (await profileRes.json()) as { emailAddress?: string };
  const accountEmail = normalizeEmail(profile.emailAddress ?? "");
  if (!accountEmail) {
    throw new Error("Gmail profile did not return an email address.");
  }

  const aliases = parseAllowedAliases();
  const isSenderAllowed =
    normalizedSender === accountEmail || aliases.includes(normalizedSender);

  if (!isSenderAllowed) {
    throw new Error(
      `GMAIL_SENDER_EMAIL (${sender}) is not aligned with OAuth mailbox (${accountEmail}). ` +
        "Set GMAIL_SENDER_EMAIL to the OAuth account email, or add a verified alias to GMAIL_ALLOWED_SENDER_ALIASES.",
    );
  }
};
