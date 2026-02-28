import {
  GoogleAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { User, setUser } from "@/lib/features/auth/authSlice";
import { useAppDispatch } from "@/lib/hooks";

const isFirebaseError = (error: unknown): error is FirebaseError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "name" in error
  );
};

export function useGoogleLogin() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const completeServerLogin = async (
    firebaseUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null; getIdToken: () => Promise<string> },
    redirectTo?: string,
  ): Promise<User> => {
    const idToken = await firebaseUser.getIdToken();

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      let serverMessage = "";
      try {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const body = await response.json();
          if (typeof body?.error === "string") serverMessage = body.error;
        }
      } catch {
        // ignore parse errors
      }

      throw new Error(
        serverMessage || `Failed to authenticate with backend (HTTP ${response.status})`,
      );
    }

    const data = await response.json();
    const serverUser = data.user;

    const user: User = {
      uid: serverUser?.uid || firebaseUser.uid,
      email: serverUser?.email || firebaseUser.email,
      displayName: serverUser?.displayName || firebaseUser.displayName,
      firstName: serverUser?.firstName || null,
      lastName: serverUser?.lastName || null,
      photoURL: serverUser?.photoURL || firebaseUser.photoURL,
      role: serverUser?.role || "USER",
      username: serverUser?.username || null,
      hasPassword: serverUser?.hasPassword ?? true,
      isNewUser: serverUser?.isNewUser ?? false,
    };

    console.log("🔍 Google Login - User data received:", {
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      hasPassword: user.hasPassword,
      isNewUser: user.isNewUser,
    });

    // Check if profile is complete - username, name, and password login must exist.
    const hasCompleteProfile =
      user.username &&
      user.username.trim() !== "" &&
      user.firstName &&
      user.firstName.trim() !== "" &&
      user.lastName &&
      user.lastName.trim() !== "" &&
      user.hasPassword;

    console.log("🔍 Profile completion check:", {
      hasCompleteProfile,
      checks: {
        hasUsername: Boolean(user.username && user.username.trim() !== ""),
        hasFirstName: Boolean(user.firstName && user.firstName.trim() !== ""),
        hasLastName: Boolean(user.lastName && user.lastName.trim() !== ""),
        hasPassword: Boolean(user.hasPassword),
      },
    });

    if (hasCompleteProfile) {
      console.log("✅ Profile is complete, redirecting to dashboard...");
      dispatch(setUser(user));
      const fallback = user.role === "ADMIN" ? "/admin" : "/dashboard";
      router.push(redirectTo || fallback);
    } else {
      console.log("⚠️ Profile incomplete, will show Complete Profile flow");
    }

    return user;
  };

  const signInWithGoogle = async (opts?: {
    redirectTo?: string;
    emailHint?: string;
    passwordForLink?: string;
  }): Promise<User> => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      return await completeServerLogin(result.user, opts?.redirectTo);
    } catch (error: unknown) {
      const code = isFirebaseError(error) ? error.code : undefined;
      const pendingCredential = isFirebaseError(error)
        ? GoogleAuthProvider.credentialFromError(error)
        : null;
      const conflictEmail =
        (error as { customData?: { email?: string } })?.customData?.email ||
        opts?.emailHint;

      if (
        code === "auth/account-exists-with-different-credential" &&
        pendingCredential &&
        conflictEmail
      ) {
        if (!opts?.passwordForLink) {
          throw new Error(
            "This email already exists. Enter your password, then click Google again to link your account.",
          );
        }

        const existingAccount = await signInWithEmailAndPassword(
          auth,
          conflictEmail,
          opts.passwordForLink,
        );

        try {
          await linkWithCredential(existingAccount.user, pendingCredential);
        } catch (linkError: unknown) {
          const linkCode = (linkError as { code?: string })?.code;
          if (linkCode !== "auth/provider-already-linked") {
            throw linkError;
          }
        }

        return await completeServerLogin(existingAccount.user, opts.redirectTo);
      }

      throw error;
    }
  };

  return { signInWithGoogle };
}
