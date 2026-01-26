import cloudinary from "@/lib/cloudinary";

const DEFAULT_AVATARS_FOLDER = "seatwise/avatars/default_avatars";

/**
 * Dynamically fetches all images from a specific Cloudinary folder.
 * This must be called from a Server Component or API route.
 * @returns Array of secure URLs for the avatars
 */
export async function getDefaultAvatarsFromCloudinary() {
    try {
        const result = await cloudinary.search
            .expression(`folder:${DEFAULT_AVATARS_FOLDER}`)
            .sort_by("public_id", "asc")
            .max_results(30)
            .execute();

        return result.resources.map((resource: { secure_url?: string }) => resource.secure_url ?? "") as string[];
    } catch (error) {
        console.error("Error fetching default avatars from Cloudinary:", error);
        // Return empty array or fallback to prevent page crash
        return [];
    }
}

/**
 * Legacy/Sync helper if needed, but preferred to use the async version above.
 */
export function getBaseCloudinaryUrl() {
    const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${DEFAULT_AVATARS_FOLDER}`;
}
