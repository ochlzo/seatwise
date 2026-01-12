import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { getUserByFirebaseUid, upsertUser, isNewUser, updateUserAvatar, resolveAvatarUrl } from "@/lib/db/Users";
import { uploadGoogleAvatar } from "@/lib/actions/uploadGoogleAvatar";

export async function POST(req: NextRequest) {
  try {
    let idToken, username, reqFirstName, reqLastName;
    try {
      ({
        idToken,
        username,
        firstName: reqFirstName,
        lastName: reqLastName,
      } = await req.json());
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Read existing user so provider logins (e.g. Google) don't overwrite username
    // with null when no username is supplied.
    let existingUser: Awaited<ReturnType<typeof getUserByFirebaseUid>> = null;
    try {
      existingUser = await getUserByFirebaseUid(uid);
    } catch {
      existingUser = null;
    }

    const email =
      decoded.email || (existingUser?.email as string | null) || null;

    const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    const requestedUsername =
      typeof username === "string" && username.trim() !== ""
        ? username.trim()
        : null;
    const existingUsername =
      typeof existingUser?.username === "string" &&
        existingUser.username.trim() !== ""
        ? existingUser.username.trim()
        : null;

    let finalFirstName =
      typeof reqFirstName === "string" && reqFirstName.trim() !== ""
        ? reqFirstName.trim()
        : typeof existingUser?.first_name === "string" &&
          (existingUser.first_name as string).trim() !== ""
          ? (existingUser.first_name as string).trim()
          : null;

    let finalLastName =
      typeof reqLastName === "string" && reqLastName.trim() !== ""
        ? reqLastName.trim()
        : typeof existingUser?.last_name === "string" &&
          (existingUser.last_name as string).trim() !== ""
          ? (existingUser.last_name as string).trim()
          : null;

    if ((!finalFirstName || finalFirstName === "") && decoded.name) {
      const nameParts = decoded.name.trim().split(/\s+/);
      if (nameParts.length > 1) {
        const lastName = nameParts.pop();
        const firstName = nameParts.join(" ");
        finalFirstName = firstName || null;
        if (!finalLastName || finalLastName === "") {
          finalLastName = lastName || null;
        }
      } else {
        finalFirstName = nameParts[0] || null;
      }
    }

    const user = await upsertUser({
      firebase_uid: uid,
      email,
      first_name: finalFirstName,
      last_name: finalLastName,
      username: requestedUsername ?? existingUsername,
    });

    const newlyCreated = isNewUser(
      user,
      decoded.firebase?.sign_in_provider as string | undefined
    );

    const firebaseUser = await adminAuth.getUser(uid);
    const hasPassword = firebaseUser.providerData.some(
      (p) => p.providerId === "password"
    );

    // If new Google user, upload their profile picture to Cloudinary
    if (newlyCreated && decoded.picture) {
      const avatarUrl = await uploadGoogleAvatar(uid, decoded.picture);
      if (avatarUrl) {
        await updateUserAvatar(uid, avatarUrl);
        // Refresh the user object to get the new avatar_key
        const refreshedUser = await getUserByFirebaseUid(uid);
        if (refreshedUser) {
          return NextResponse.json({
            user: {
              uid: refreshedUser.firebase_uid,
              email: refreshedUser.email,
              displayName: `${refreshedUser.first_name || ""} ${refreshedUser.last_name || ""}`.trim(),
              username: refreshedUser.username,
              photoURL: resolveAvatarUrl(refreshedUser.avatarKey, refreshedUser.username, refreshedUser.email),
              role: refreshedUser.role,
              hasPassword,
              isNewUser: true,
            },
          });
        }
      }
    }

    return NextResponse.json({
      user: {
        uid: user.firebase_uid,
        email: user.email,
        displayName: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
        username: user.username,
        photoURL: resolveAvatarUrl(user.avatarKey, user.username, user.email),
        role: user.role,
        hasPassword,
        isNewUser: newlyCreated,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Authentication failed";

    if (process.env.NODE_ENV !== "production") {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code)
          : undefined;
      console.warn("Login error", { message, code });
    }

    const isServerConfigIssue =
      message.toLowerCase().includes("missing firebase admin credentials") ||
      message.toLowerCase().includes("failed to parse private key") ||
      message.toLowerCase().includes("credential");

    const status = isServerConfigIssue
      ? 500
      : message.includes("Missing email")
        ? 400
        : 401;

    return NextResponse.json(
      {
        error:
          status === 500
            ? "Server authentication is not configured correctly"
            : status === 400
              ? "Missing email"
              : "Invalid token",
      },
      { status }
    );
  }
}
