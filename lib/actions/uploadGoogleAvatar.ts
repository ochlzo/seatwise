import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

/**
 * Fetches a user's avatar from a Google URL and uploads it to R2.
 * @param uid The user's Firebase UID
 * @param photoURL The Google profile picture URL from the Firebase token
 * @returns The key (path) of the uploaded file in R2
 */
export async function uploadGoogleAvatar(uid: string, photoURL: string) {
    if (!photoURL) return null;

    try {
        // 1. Fetch the image content from Google
        const response = await fetch(photoURL);
        if (!response.ok) throw new Error("Failed to fetch image from Google");

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Define the path (key)
        // Destination: seatwise-profile-pics/default-avatar/google-profile-pics/{uid}.jpg
        const key = `default-avatar/google-profile-pics/${uid}.jpg`;

        // 3. Upload to Cloudflare R2
        const result = await r2.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BUCKET!,
                Key: key,
                Body: buffer,
                ContentType: "image/jpeg",
            })
        );

        console.log("✅ R2 Upload Success for UID:", uid, result);
        return key;
    } catch (error) {
        console.error("Error in uploadGoogleAvatar:", error);
        return null;
    }
}
