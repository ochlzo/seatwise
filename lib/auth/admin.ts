import { adminAuth } from "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  try {
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );
    console.log("verifyAdmin: Token verified, UID:", decodedToken.uid);

    const user = await prisma.user.findUnique({
      where: { firebase_uid: decodedToken.uid },
    });
    console.log("verifyAdmin: User found:", user?.email, user?.role);

    if (!user || user.role !== "ADMIN") {
      console.log("verifyAdmin: Access denied. Role:", user?.role);
      redirect("/dashboard");
    }

    return user;
  } catch (error) {
    console.log("verifyAdmin: Error:", error);
    redirect("/login");
  }
}
