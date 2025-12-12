import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { User } from "@/lib/features/auth/authSlice";

export function useGoogleLogin() {
  const router = useRouter();

  const signInWithGoogle = async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    const firebaseUser = result.user;
    const idToken = await firebaseUser.getIdToken();

    // send token to your backend
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      let errorDetails = "";
      try {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const body = await response.json();
          const parts: string[] = [];
          if (body?.error) parts.push(String(body.error));
          if (body?.details) parts.push(String(body.details));
          errorDetails = parts.length ? `: ${parts.join(" — ")}` : "";
        } else {
          const bodyText = await response.text();
          errorDetails = bodyText ? `: ${bodyText}` : "";
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(
        `Failed to authenticate with backend (HTTP ${response.status})${errorDetails}`
      );
    }

    const data = await response.json();
    const role = data.user?.role || "USER";
    const username = data.user?.username || null;

    if (username) {
      if (role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      role: role,
      username: username,
    };
  };

  return { signInWithGoogle };
}
