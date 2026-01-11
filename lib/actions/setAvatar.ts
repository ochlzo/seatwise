"use server";

import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { updateUserAvatar } from "@/lib/db/Users";
import { revalidatePath } from "next/cache";

/**
 * Server Action to update the user's avatar key (URL) in the database.
 * @param avatarUrl The new avatar URL to save
 */
export async function setAvatarAction(avatarUrl: string) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) {
            throw new Error("Unauthorized");
        }

        // Verify session
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);

        // Update DB
        await updateUserAvatar(decodedToken.uid, avatarUrl);

        // Revalidate the profile page to show the new avatar
        revalidatePath("/profile");

        return { success: true };
    } catch (error) {
        console.error("Error setting avatar:", error);
        return { success: false, error: "Failed to update profile picture" };
    }
}
