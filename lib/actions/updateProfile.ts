"use server";

import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Server Action to update user profile details.
 */
export async function updateProfileAction(data: {
    username: string;
    first_name: string;
    last_name: string;
}) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) {
            return { success: false, error: "Unauthorized" };
        }

        // 1. Verify session
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
        const uid = decodedToken.uid;

        // 2. Normalize and validate inputs
        const username = data.username.trim().toLowerCase();
        const firstName = data.first_name.trim();
        const lastName = data.last_name.trim();

        if (username.length < 2 || username.length > 30) {
            return { success: false, error: "Username must be between 2 and 30 characters." };
        }

        if (!firstName) return { success: false, error: "First name is required." };
        if (!lastName) return { success: false, error: "Last name is required." };

        // 3. Check for username uniqueness (excluding current user)
        const existingUser = await prisma.user.findFirst({
            where: {
                username: username,
                firebase_uid: { not: uid }
            }
        });

        if (existingUser) {
            return { success: false, error: "Username is already taken." };
        }

        // 4. Update Database
        await prisma.user.update({
            where: { firebase_uid: uid },
            data: {
                username,
                first_name: firstName,
                last_name: lastName
            }
        });

        // 5. Revalidate to refresh cache
        revalidatePath("/profile");

        return { success: true };
    } catch (error) {
        console.error("Error updating profile:", error);
        return { success: false, error: "An unexpected error occurred." };
    }
}
