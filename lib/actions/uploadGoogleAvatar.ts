import cloudinary from "@/lib/cloudinary";

/**
 * Fetches a user's avatar from a Google URL and uploads it to Cloudinary.
 * @param uid The user's Firebase UID
 * @param photoURL The Google profile picture URL from the Firebase token
 * @returns The secure URL of the uploaded file in Cloudinary
 */
export async function uploadGoogleAvatar(uid: string, photoURL: string) {
    if (!photoURL) return null;

    try {
        // Cloudinary can upload directly from a URL, which is more efficient
        const uploadResponse = await cloudinary.uploader.upload(photoURL, {
            folder: "seatwise/avatars/google_avatars",
            public_id: uid,
            overwrite: true,
            resource_type: "image",
        });

        console.log("✅ Cloudinary Upload Success for UID:", uid, uploadResponse.secure_url);

        // Return the secure URL to be stored in the database avatar_key column
        return uploadResponse.secure_url;
    } catch (error) {
        console.error("Error in uploadGoogleAvatar (Cloudinary):", error);
        return null;
    }
}
