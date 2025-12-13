import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebaseClient";
import { User } from "@/lib/features/auth/authSlice";
import { useRouter } from "next/navigation";

export function useEmailPass() {
  const router = useRouter();

  const getAuthErrorMessage = (error: unknown): string => {
    const maybeFirebaseError = error as Partial<FirebaseError> | null;
    const code = maybeFirebaseError?.code;

    switch (code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Invalid email or password";
      case "auth/invalid-email":
        return "Invalid email address";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      default:
        if (error instanceof Error && error.message.trim() !== "") {
          return error.message;
        }
        return "Unable to sign in. Please try again.";
    }
  };

  const readApiError = async (response: Response): Promise<string> => {
    try {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data?.error === "string" && data.error.trim() !== "") {
        return data.error;
      }
      return "Request failed";
    } catch {
      return "Request failed";
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    username: string,
    firstName: string,
    lastName: string
  ): Promise<User> => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = result.user;

      // Update Firebase Profile
      const displayName = `${firstName} ${lastName}`.trim();
      await updateProfile(firebaseUser, { displayName });

      const idToken = await firebaseUser.getIdToken();

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          username,
          firstName,
          lastName,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = await response.json();
      const role = data.user?.role || "USER";

      // Redirect based on role (though usually new users are USER)
      if (role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: displayName,
        photoURL: firebaseUser.photoURL,
        role: role,
        username: username,
      };
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signInWithEmail = async (
    email: string,
    pass: string
  ): Promise<User> => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = await response.json();
      const role = data.user?.role || "USER";

      if (role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        role: role,
        username: data.user?.username || null,
      };
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return { signUpWithEmail, signInWithEmail, resetPassword };
}
