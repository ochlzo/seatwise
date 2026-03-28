export type UploadPurpose =
  | "show-thumbnail"
  | "avatar-custom"
  | "ticket-template-asset";

import type { TicketTemplateVersion } from "@/lib/tickets/types";

type SignedUploadResponse = {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats?: string;
  publicId?: string;
  overwrite?: boolean;
  invalidate?: boolean;
};

type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

export async function uploadImageToCloudinary(
  file: File | string,
  purpose: UploadPurpose,
  options?: {
    ticketTemplateId?: string | null;
    uploadKey?: string | null;
  },
): Promise<CloudinaryUploadResult> {
  const signResponse = await fetch("/api/uploads/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose,
      ticketTemplateId: options?.ticketTemplateId ?? undefined,
      uploadKey: options?.uploadKey ?? undefined,
    }),
  });

  if (!signResponse.ok) {
    const err = await signResponse.json().catch(() => ({}));
    throw new Error(err.error || "Failed to prepare image upload");
  }

  const signed = (await signResponse.json()) as SignedUploadResponse;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signed.apiKey);
  formData.append("timestamp", String(signed.timestamp));
  formData.append("signature", signed.signature);
  formData.append("folder", signed.folder);
  if (signed.allowedFormats) {
    formData.append("allowed_formats", signed.allowedFormats);
  }

  if (signed.publicId) {
    formData.append("public_id", signed.publicId);
  }
  if (signed.overwrite) {
    formData.append("overwrite", "true");
  }
  if (signed.invalidate) {
    formData.append("invalidate", "true");
  }

  const uploadResponse = await fetch(signed.uploadUrl, {
    method: "POST",
    body: formData,
  });

  const uploadData = (await uploadResponse.json().catch(() => ({}))) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };

  if (!uploadResponse.ok || !uploadData.secure_url || !uploadData.public_id) {
    throw new Error(uploadData.error?.message || "Image upload failed");
  }

  return {
    secureUrl: uploadData.secure_url,
    publicId: uploadData.public_id,
  };
}

type ResolveTicketTemplateAssetRefsOptions = {
  ticketTemplateId?: string | null;
  uploadKey?: string | null;
  uploadAsset?: (
    file: File | string,
    purpose: UploadPurpose,
    options?: {
      ticketTemplateId?: string | null;
      uploadKey?: string | null;
    },
  ) => Promise<CloudinaryUploadResult>;
};

export async function resolveTicketTemplateAssetRefsForSave(
  templateSchema: TicketTemplateVersion,
  options?: ResolveTicketTemplateAssetRefsOptions,
): Promise<TicketTemplateVersion> {
  const uploadAsset = options?.uploadAsset ?? uploadImageToCloudinary;

  const nodes = await Promise.all(
    templateSchema.nodes.map(async (node) => {
      if (node.kind !== "asset") {
        return node;
      }

      if (node.assetKey) {
        return node;
      }

      if (!node.src) {
        throw new Error(`Asset "${node.name ?? node.id}" is missing local image data.`);
      }

      const uploaded = await uploadAsset(node.src, "ticket-template-asset", {
        ticketTemplateId: options?.ticketTemplateId,
        uploadKey: options?.uploadKey,
      });

      return {
        ...node,
        src: uploaded.secureUrl,
        assetKey: uploaded.publicId,
      };
    }),
  );

  return {
    canvas: templateSchema.canvas,
    nodes,
  };
}
