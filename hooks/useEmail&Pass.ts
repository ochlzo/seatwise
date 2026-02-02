import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { User } from "@/lib/features/auth/authSlice";
import { useRouter } from "next/navigation";

export const getAuthErrorMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code;

  switch (code) {
    // Login Errors
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password. Please check your credentials and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many unsuccessful attempts. Your account has been temporarily locked. Please try again later.";

    // Signup Errors
    case "auth/email-already-in-use":
      return "This email is already registered. If you forgot your password, try resetting it.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters with a mix of letters and numbers.";
    case "auth/operation-not-allowed":
      return "Email/password accounts are not enabled. Please contact the administrator.";

    // General / Security Errors
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/requires-recent-login":
      return "For security reasons, please log in again before making this change.";
    case "auth/internal-error":
      return "An internal authentication error occurred. Please try again later.";

    default:
      if (
        error instanceof Error &&
        error.message.trim() !== "" &&
        !error.message.includes("Firebase:")
      ) {
        return error.message;
      }
      return "An unexpected error occurred. Please try again.";
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

export function useEmailPass() {
  const router = useRouter();

  const signUpWithEmail = async (
    email: string,
    pass: string,
    username: string,
    firstName: string,
    lastName: string,
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
      const serverUser = data.user;

      // Redirect based on role (though usually new users are USER)
      if (serverUser?.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }

      return {
        uid: serverUser?.uid || firebaseUser.uid,
        email: serverUser?.email || firebaseUser.email,
        displayName: serverUser?.displayName || displayName,
        firstName: serverUser?.firstName || firstName,
        lastName: serverUser?.lastName || lastName,
        photoURL: serverUser?.photoURL || firebaseUser.photoURL,
        role: serverUser?.role || "USER",
        username: serverUser?.username || username,
        hasPassword: true,
      };
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signInWithEmail = async (
    email: string,
    pass: string,
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
      const serverUser = data.user;

      if (serverUser?.username) {
        if (serverUser.role === "ADMIN") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
      }

      return {
        uid: serverUser?.uid || firebaseUser.uid,
        email: serverUser?.email || firebaseUser.email,
        displayName: serverUser?.displayName || firebaseUser.displayName,
        firstName: serverUser?.firstName || null,
        lastName: serverUser?.lastName || null,
        photoURL: serverUser?.photoURL || firebaseUser.photoURL,
        role: serverUser?.role || "USER",
        username: serverUser?.username || null,
        hasPassword: serverUser?.hasPassword ?? true,
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
