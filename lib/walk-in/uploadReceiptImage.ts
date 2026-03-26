import cloudinary from "@/lib/cloudinary";

import { buildWalkInReceiptUploadDataUri, type WalkInReceiptPayload } from "@/lib/walk-in/receipt";

export const uploadWalkInReceiptImage = async (
  payload: WalkInReceiptPayload,
  options?: {
    folder?: string;
    publicIdPrefix?: string;
    format?: string;
  },
) => {
  const upload = await cloudinary.uploader.upload(buildWalkInReceiptUploadDataUri(payload), {
    folder: options?.folder ?? "seatwise/settings/walk_in_receipts",
    resource_type: "image",
    format: options?.format ?? "png",
    public_id: `${options?.publicIdPrefix ?? "walk-in"}-${payload.reservationNumber}`,
  });

  return upload.secure_url;
};
