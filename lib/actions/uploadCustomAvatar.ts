"use server";

import cloudinary from "@/lib/cloudinary";
import { adminAuth } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";

/**
 * Uploads a custom avatar (base64) to Cloudinary for the authenticated user.
 * @param base64Image The base64 string of the image
 * @returns The secure URL of the uploaded image
 */
export async function uploadCustomAvatarAction(base64Image: string) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) {
            throw new Error("Unauthorized");
        }

        // Verify session to get the user's UID
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
        const uid = decodedToken.uid;

        // Upload to Cloudinary
        // We overwrite the existing custom avatar for this user to save space
        const uploadResponse = await cloudinary.uploader.upload(base64Image, {
            folder: "seatwise/avatars/user_custom",
            public_id: uid,
            overwrite: true,
            resource_type: "image",
        });

        console.log("✅ Custom Avatar Upload Success for UID:", uid, uploadResponse.secure_url);

        return { success: true, url: uploadResponse.secure_url };
    } catch (error) {
        console.error("Error in uploadCustomAvatarAction:", error);
        return { success: false, error: "Failed to upload image" };
    }
}
