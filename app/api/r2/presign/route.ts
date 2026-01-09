// app/api/r2/presign/route.ts
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

export async function POST(req: Request) {
    // 1. Authenticate the user via Session Cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let uid: string;
    try {
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
        uid = decodedClaims.uid;
    } catch (error) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and Validate Request
    const { key, contentType } = await req.json();

    // Enforce folder structure: users/{uid}/...
    if (!key || !key.startsWith(`users/${uid}/`)) {
        return NextResponse.json(
            { error: "Invalid key. Must start with your user folder." },
            { status: 400 }
        );
    }

    // 3. Generate Presigned URL
    const cmd = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        ContentType: contentType || "application/octet-stream",
    });

    try {
        const url = await getSignedUrl(r2, cmd, { expiresIn: 60 });
        return NextResponse.json({ url });
    } catch (error) {
        console.error("Presign error:", error);
        return NextResponse.json({ error: "Could not generate URL" }, { status: 500 });
    }
}