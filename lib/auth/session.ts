import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByFirebaseUid } from "@/lib/db/Users";

/**
 * Verifies if the request has a valid session cookie.
 * used in server components/layouts to protect routes.
 */
export async function verifySession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
        redirect("/login");
    }

    try {
        const decodedToken = await adminAuth.verifySessionCookie(
            sessionCookie,
            true // Check if revoked
        );

        const user = await getUserByFirebaseUid(decodedToken.uid);

        if (!user) {
            redirect("/login");
        }

        return user;
    } catch {
        redirect("/login");
    }
}
