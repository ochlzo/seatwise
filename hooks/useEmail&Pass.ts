import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { User } from "@/lib/features/auth/authSlice";
import { useRouter } from "next/navigation";

export function useEmailPass() {
  const router = useRouter();

  const signUpWithEmail = async (
    email: string,
    pass: string,
    username: string,
    firstName: string,
    lastName: string
  ): Promise<User> => {
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
      throw new Error("Failed to create user in backend");
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
  };

  const signInWithEmail = async (
    email: string,
    pass: string
  ): Promise<User> => {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    const firebaseUser = result.user;
    const idToken = await firebaseUser.getIdToken();

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      throw new Error("Failed to login with backend");
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
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return { signUpWithEmail, signInWithEmail, resetPassword };
}
