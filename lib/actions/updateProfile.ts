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
        const username = data.username.trim();
        const firstName = data.first_name.trim();
        const lastName = data.last_name.trim();

        if (username.length < 2 || username.length > 20) {
            return { success: false, error: "Username must be between 2 and 20 characters." };
        }

        if (!firstName) return { success: false, error: "First name is required." };
        if (!lastName) return { success: false, error: "Last name is required." };

        // 3. Check for username uniqueness (excluding current user) - case-insensitive check
        const normalizedUsername = username.toLowerCase();
        const existingUser = await prisma.user.findFirst({
            where: {
                username: {
                    equals: normalizedUsername,
                    mode: 'insensitive'
                },
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

/**
 * Server Action to check if a username is unique.
 */
export async function checkUsernameAction(username: string, excludeUid?: string) {
    try {
        const normalized = username.trim().toLowerCase();
        if (normalized.length < 2) return { taken: false };

        const existingUser = await prisma.user.findFirst({
            where: {
                username: {
                    equals: normalized,
                    mode: 'insensitive'
                },
                firebase_uid: excludeUid ? { not: excludeUid } : undefined
            }
        });

        return { taken: !!existingUser };
    } catch (error) {
        console.error("Error checking username uniqueness:", error);
        return { taken: false, error: "Failed to check uniqueness" };
    }
}

/**
 * Server Action to check if an email is already registered.
 */
export async function checkEmailAction(email: string) {
    try {
        const normalized = email.trim().toLowerCase();
        if (normalized.length < 5 || !normalized.includes("@")) return { taken: false };

        const existingUser = await prisma.user.findFirst({
            where: {
                email: {
                    equals: normalized,
                    mode: 'insensitive'
                }
            }
        });

        return { taken: !!existingUser };
    } catch (error) {
        console.error("Error checking email uniqueness:", error);
        return { taken: false, error: "Failed to check uniqueness" };
    }
}