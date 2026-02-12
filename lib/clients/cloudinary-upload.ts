export type UploadPurpose = "show-thumbnail" | "avatar-custom";

type SignedUploadResponse = {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
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
): Promise<CloudinaryUploadResult> {
  const signResponse = await fetch("/api/uploads/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose }),
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

