"use server";

import "server-only";
import { cookies } from "next/headers";
import { updateUserAvatar, getUserByFirebaseUid } from "@/lib/db/Users";
import { revalidatePath } from "next/cache";

/**
 * Extracts a Cloudinary Public ID from a secure URL.
 * Targeting: .../upload/v123.../PATH/TO/ASSET.jpg -> PATH/TO/ASSET
 */
function getPublicIdFromUrl(url: string): string | null {
    if (!url.includes("google_avatars")) return null;

    try {
        // Split by '/upload/' and then by the version segment (e.g., 'v1736386414/')
        const parts = url.split("/upload/");
        if (parts.length < 2) return null;

        // The second part contains 'v123456/seatwise/avatars/google_avatars/filename.jpg'
        const pathWithVersion = parts[1];
        const pathParts = pathWithVersion.split("/");

        // Remove the version segment (the first one starting with 'v')
        const pathSegments = pathParts[0].startsWith("v") ? pathParts.slice(1) : pathParts;

        // Join them back and strip the file extension
        const fullPath = pathSegments.join("/");
        return fullPath.split(".").slice(0, -1).join(".");
    } catch (error) {
        console.error("Failed to extract Public ID:", error);
        return null;
    }
}

/**
 * Combined Server Action to handle both custom avatar uploads and preset updates.
 * @param avatarData The avatar URL (for presets) or base64 string (for custom)
 * @param isCustom Whether the provided data is a base64 string needing upload
 */
export async function updateAvatarAction(avatarData: string, isCustom: boolean) {
    try {
        // Dynamic imports to ensure node-only modules aren't bundled for client
        const [cloudinaryPart, firebaseAdminPart] = await Promise.all([
            import("@/lib/cloudinary"),
            import("@/lib/firebaseAdmin")
        ]);
        const cloudinary = cloudinaryPart.default;
        const { adminAuth } = firebaseAdminPart;

        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) {
            throw new Error("Unauthorized");
        }

        // Verify session to get UID
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
        const uid = decodedToken.uid;

        // 1. Fetch current user to check for previous Google avatars
        const existingUser = await getUserByFirebaseUid(uid);
        const oldAvatarUrl = existingUser?.avatarKey;

        if (oldAvatarUrl && oldAvatarUrl.includes("google_avatars")) {
            const publicId = getPublicIdFromUrl(oldAvatarUrl);
            if (publicId) {
                console.log("🗑️ Deleting old Google avatar:", publicId);
                await cloudinary.uploader.destroy(publicId).catch(err =>
                    console.error("Failed to delete old asset from Cloudinary:", err)
                );
            }
        }

        let finalAvatarUrl = avatarData;

        // 2. Backward compatibility:
        // If custom data URL is still passed, upload it server-side.
        if (isCustom && avatarData.startsWith("data:")) {
            const uploadResponse = await cloudinary.uploader.upload(avatarData, {
                folder: "seatwise/avatars/user_custom",
                public_id: uid,
                overwrite: true,
                resource_type: "image",
            });
            finalAvatarUrl = uploadResponse.secure_url;
            console.log("✅ Custom Avatar Upload Success for UID:", uid);
        }

        // 3. Update Database via Prisma
        await updateUserAvatar(uid, finalAvatarUrl);

        // 4. Revalidate path to refresh server components
        revalidatePath("/profile");

        return { success: true, url: finalAvatarUrl };
    } catch (error) {
        console.error("Error in updateAvatarAction:", error);
        return { success: false, error: "Failed to update profile picture" };
    }
}
