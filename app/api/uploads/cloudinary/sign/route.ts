import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import cloudinary from "@/lib/cloudinary";
import { adminAuth } from "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";

type UploadPurpose =
  | "show-thumbnail"
  | "avatar-custom"
  | "gcash-receipt"
  | "ticket-template-asset";

const PURPOSES: Record<
  UploadPurpose,
  {
    requiresAdmin: boolean;
    buildFolder: (params: {
      ticketTemplateId?: string;
      uploadKey?: string;
    }) => string;
    allowedFormats?: string;
  }
> = {
  "show-thumbnail": {
    requiresAdmin: true,
    buildFolder: () => "seatwise/show_thumbnails",
  },
  "avatar-custom": {
    requiresAdmin: false,
    buildFolder: () => "seatwise/avatars/user_custom",
  },
  "gcash-receipt": {
    requiresAdmin: false,
    buildFolder: () => "seatwise/settings/payment_submission",
  },
  "ticket-template-asset": {
    requiresAdmin: true,
    buildFolder: ({ ticketTemplateId, uploadKey }) => {
      const folderKey = (ticketTemplateId?.trim() || uploadKey?.trim() || "draft")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

      return `seatwise/ticket_templates/${folderKey || "draft"}/assets`;
    },
    allowedFormats: "png",
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          purpose?: UploadPurpose;
          ticketTemplateId?: string;
          uploadKey?: string;
        }
      | null;
    const purpose = body?.purpose;

    if (!purpose || !(purpose in PURPOSES)) {
      return NextResponse.json({ error: "Invalid upload purpose" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;

    const config = PURPOSES[purpose];
    const folder = config.buildFolder({
      ticketTemplateId: body?.ticketTemplateId,
      uploadKey: body?.uploadKey,
    });

    if (config.requiresAdmin) {
      const admin = await prisma.admin.findUnique({
        where: { firebase_uid: uid },
        select: { user_id: true },
      });
      if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = {
      folder,
      timestamp,
    };

    if (config.allowedFormats) {
      paramsToSign.allowed_formats = config.allowedFormats;
    }

    if (purpose === "avatar-custom") {
      paramsToSign.public_id = uid;
      paramsToSign.overwrite = "true";
      paramsToSign.invalidate = "true";
    }

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    if (!apiSecret || !apiKey || !cloudName) {
      return NextResponse.json(
        { error: "Cloudinary is not configured" },
        { status: 500 },
      );
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return NextResponse.json({
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      apiKey,
      cloudName,
      timestamp,
      signature,
      folder,
      allowedFormats: config.allowedFormats,
      publicId: purpose === "avatar-custom" ? uid : undefined,
      overwrite: purpose === "avatar-custom",
      invalidate: purpose === "avatar-custom",
    });
  } catch (error) {
    console.error("Error signing Cloudinary upload:", error);
    return NextResponse.json({ error: "Failed to sign upload" }, { status: 500 });
  }
}


