import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { User, setUser } from "@/lib/features/auth/authSlice";
import { useAppDispatch } from "@/lib/hooks";

export function useGoogleLogin() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const signInWithGoogle = async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    const firebaseUser = result.user;
    const idToken = await firebaseUser.getIdToken();

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      // ... existing error handling ...
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
        serverMessage || `Failed to authenticate with backend (HTTP ${response.status})`
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

    const user: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      role: role,
      username: username,
    };

    dispatch(setUser(user));

    return user;
  };

  return { signInWithGoogle };
}