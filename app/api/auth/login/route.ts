import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { lambdaUpsertUser } from "@/lib/usersLambda";

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
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // 1. Verify with Firebase Admin (Check if ID token is valid first)
    // Note: createSessionCookie verifies the token implicitly, but explicit verification
    // allows extracting claims before creating the session if needed.
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || null;

    // 2. Create Session Cookie
    const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000, // Convert milliseconds to seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    let finalFirstName = reqFirstName || null;
    let finalLastName = reqLastName || null;

    // Fall back to decoded display name if first/last names weren't provided
    if ((!finalFirstName || finalFirstName.trim() === "") && decoded.name) {
      const [fName, ...rest] = decoded.name.split(" ");
      finalFirstName = fName;
      if (!finalLastName || finalLastName.trim() === "") {
        finalLastName = rest.join(" ") || null;
      }
    }

    const user = await lambdaUpsertUser({
      firebase_uid: uid,
      email,
      first_name: finalFirstName || null,
      last_name: finalLastName || null,
      username: username || null,
    });

    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed";

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

    // Default to 401 for auth failures, but surface config/runtime issues as 500.
    const status = isServerConfigIssue ? 500 : message.includes("Users service") ? 502 : 401;

    return NextResponse.json(
      {
        error:
          status === 500
            ? "Server authentication is not configured correctly"
            : status === 502
            ? "User service is unavailable"
            : "Invalid token",
      },
      { status }
    );
  }
}
