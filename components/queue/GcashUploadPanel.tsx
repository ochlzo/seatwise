"use client";

import * as React from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES: Record<string, string[]> = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
};

type GcashUploadPanelProps = {
    onUploadComplete: (url: string) => void;
    onBack: () => void;
    disabled?: boolean;
};

export function GcashUploadPanel({
    onUploadComplete,
    onBack,
    disabled = false,
}: GcashUploadPanelProps) {
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [uploadedUrl, setUploadedUrl] = React.useState<string | null>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);

    // Cleanup preview blob URL on unmount
    React.useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const uploadToCloudinary = React.useCallback(
        async (file: File) => {
            setIsUploading(true);
            setUploadError(null);
            setUploadProgress(0);

            try {
                // Step 1: Get a signed upload URL from our API
                const signRes = await fetch("/api/uploads/cloudinary/sign", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ purpose: "gcash-receipt" }),
                });

                if (!signRes.ok) {
                    const signData = await signRes.json();
                    throw new Error(signData.error || "Failed to get upload signature");
                }

                const { uploadUrl, apiKey, timestamp, signature, folder } =
                    await signRes.json();

                // Step 2: Upload directly to Cloudinary using XMLHttpRequest for progress
                const formData = new FormData();
                formData.append("file", file);
                formData.append("api_key", apiKey);
                formData.append("timestamp", String(timestamp));
                formData.append("signature", signature);
                formData.append("folder", folder);

                const cloudinaryUrl = await new Promise<string>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();

                    xhr.upload.addEventListener("progress", (event) => {
                        if (event.lengthComputable) {
                            const pct = Math.round((event.loaded / event.total) * 100);
                            setUploadProgress(pct);
                        }
                    });

                    xhr.addEventListener("load", () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            const data = JSON.parse(xhr.responseText);
                            resolve(data.secure_url);
                        } else {
                            reject(new Error("Upload to Cloudinary failed"));
                        }
                    });

                    xhr.addEventListener("error", () =>
                        reject(new Error("Network error during upload")),
                    );

                    xhr.open("POST", uploadUrl);
                    xhr.send(formData);
                });

                setUploadedUrl(cloudinaryUrl);
                onUploadComplete(cloudinaryUrl);
                toast.success("Screenshot uploaded successfully!");
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Upload failed. Please try again.";
                setUploadError(message);
                toast.error("Upload failed", { description: message });
            } finally {
                setIsUploading(false);
            }
        },
        [onUploadComplete],
    );

    const onDrop = React.useCallback(
        (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
            if (rejectedFiles.length > 0) {
                const firstRejection = rejectedFiles[0];
                const errorMsg = firstRejection.errors
                    .map((e) => e.message)
                    .join(", ");
                setUploadError(errorMsg);
                return;
            }

            if (acceptedFiles.length === 0) return;

            const file = acceptedFiles[0];

            // Create local preview
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(URL.createObjectURL(file));
            setUploadedUrl(null);
            setUploadError(null);

            // Start upload
            void uploadToCloudinary(file);
        },
        [previewUrl, uploadToCloudinary],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: ACCEPTED_TYPES,
        maxSize: MAX_FILE_SIZE,
        multiple: false,
        disabled: disabled || isUploading,
    });

    const handleRemoveImage = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setUploadedUrl(null);
        setUploadError(null);
        setUploadProgress(0);
        onUploadComplete("");
    };

    return (
        <div className="space-y-4">
            {/* GCash Payment QR + Instructions */}
            <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20">
                <CardContent className="space-y-4 px-4 py-4 text-sm">
                    <p className="font-semibold text-blue-800 dark:text-blue-300 text-center">
                        GCash Payment
                    </p>

                    {/* QR Code Image */}
                    <div className="flex justify-center">
                        <div className="overflow-hidden rounded-xl border-2 border-blue-200 bg-white shadow-sm dark:border-blue-800">
                            <img
                                src="/gcashimage/gcashpayment.jpg"
                                alt="GCash Payment QR Code"
                                className="h-auto w-full max-w-[240px] object-contain"
                            />
                        </div>
                    </div>

                    {/* Instructions */}
                    <ol className="list-decimal space-y-1.5 pl-5 text-blue-700 dark:text-blue-400 text-xs sm:text-sm">
                        <li>Scan the QR code above using your <strong>GCash app</strong>.</li>
                        <li>Complete the payment for the total amount shown.</li>
                        <li>Take a <strong>screenshot</strong> of the payment confirmation.</li>
                        <li>Upload the screenshot below to verify your payment.</li>
                    </ol>
                </CardContent>
            </Card>

            {/* Upload Area */}
            {!previewUrl ? (
                <div
                    {...getRootProps()}
                    className={`
            relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center
            rounded-xl border-2 border-dashed transition-all duration-200
            ${isDragActive
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
                            : "border-sidebar-border/70 bg-muted/20 hover:border-blue-400 hover:bg-muted/40"
                        }
            ${(disabled || isUploading) ? "pointer-events-none opacity-50" : ""}
          `}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-3 text-center px-4">
                        <div className="rounded-full bg-muted/60 p-3">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">
                                {isDragActive ? "Drop your screenshot here" : "Upload GCash Screenshot"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Drag & drop or click to browse. JPG, PNG, or WEBP (max 5MB)
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative rounded-xl border border-sidebar-border/70 bg-muted/10 p-3">
                    {/* Upload progress overlay */}
                    {isUploading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/80 backdrop-blur-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            <div className="w-48 space-y-1">
                                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                                <p className="text-center text-xs text-muted-foreground">
                                    Uploading... {uploadProgress}%
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Preview image */}
                    <div className="relative flex items-center justify-center">
                        <img
                            src={previewUrl}
                            alt="GCash receipt preview"
                            className="max-h-[300px] rounded-lg object-contain"
                        />

                        {/* Remove button */}
                        {!isUploading && (
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute right-1 top-1 h-7 w-7 rounded-full"
                                onClick={handleRemoveImage}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Upload status */}
                    {uploadedUrl && (
                        <div className="mt-2 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>Screenshot uploaded successfully</span>
                        </div>
                    )}
                </div>
            )}

            {/* Error message */}
            {uploadError && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{uploadError}</span>
                </div>
            )}

            {/* Back button */}
            <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={isUploading}
                className="w-full"
            >
                Back to seat selection
            </Button>
        </div>
    );
}
