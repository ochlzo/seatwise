"use server";

import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import cloudinary from "@/lib/cloudinary";

/**
 * Server Action to completely abort the signup process.
 * Deletes the user from Firebase, local database, and Cloudinary storage.
 */
export async function abortSignUpAction() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) {
            return { success: false, error: "No active session found." };
        }

        // 1. Verify session to get the UID
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true).catch(() => null);

        if (!decodedToken) {
            // If token is invalid/expired, still try to clear cookies
            cookieStore.delete("session");
            return { success: false, error: "Invalid session." };
        }

        const uid = decodedToken.uid;

        // 2. Delete from Firebase Auth
        try {
            await adminAuth.deleteUser(uid);
        } catch (fbError: unknown) {
            console.error("Firebase user deletion failed:", fbError);
            const errorCode =
                fbError && typeof fbError === "object" && "code" in fbError
                    ? String((fbError as { code?: unknown }).code)
                    : "";
            if (errorCode !== "auth/user-not-found") {
                return { success: false, error: "Failed to delete Firebase account." };
            }
        }

        // 3. Delete avatar from Cloudinary (if it exists)
        try {
            const publicId = `seatwise/avatars/google_avatars/${uid}`;
            await cloudinary.uploader.destroy(publicId);
        } catch (cloudError) {
            console.warn("Cloudinary avatar deletion failed:", cloudError);
            // Non-blocking
        }

        // 4. Delete from Prisma Database
        try {
            await prisma.user.delete({
                where: { firebase_uid: uid }
            });
        } catch (dbError) {
            console.warn("Prisma user deletion failed or user not found:", dbError);
            // Non-blocking if record already gone
        }

        // 5. Clear cookies and revalidate
        cookieStore.delete("session");
        revalidatePath("/");

        return { success: true };
    } catch (error) {
        console.error("Critical error during abortSignUp:", error);
        return { success: false, error: "A critical error occurred during account deletion." };
    }
}
