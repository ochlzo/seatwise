"use client";

import * as React from "react";
import { Expand, Download, Copy } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ImageUploadDropzone } from "@/components/ui/image-upload-dropzone";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_DIMENSION = 1280;
const IMAGE_OUTPUT_QUALITY = 0.78;
const ACCEPTED_TYPES: Record<string, string[]> = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
};

type GcashUploadPanelProps = {
    onUploadComplete: (url: string) => void;
    onBack?: () => void;
    disabled?: boolean;
    qrImageUrl?: string | null;
    gcashNumber?: string | null;
    gcashAccountName?: string | null;
};

export function GcashUploadPanel({
    onUploadComplete,
    onBack,
    disabled = false,
    qrImageUrl,
    gcashNumber,
    gcashAccountName,
}: GcashUploadPanelProps) {
    const [isQrFullscreenOpen, setIsQrFullscreenOpen] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [storedAsset, setStoredAsset] = React.useState<string | null>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);

    const compressImageToBase64 = React.useCallback(async (file: File) => {
        const imageBitmap = await createImageBitmap(file);
        const { width, height } = imageBitmap;
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            imageBitmap.close();
            throw new Error("Failed to process screenshot.");
        }

        ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
        imageBitmap.close();

        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        return canvas.toDataURL(mimeType, IMAGE_OUTPUT_QUALITY);
    }, []);

    const readFileAsBase64 = React.useCallback(
        async (file: File) => {
            setIsProcessing(true);
            setUploadError(null);

            try {
                const base64Asset = await compressImageToBase64(file);

                setPreviewUrl(base64Asset);
                setStoredAsset(base64Asset);
                onUploadComplete(base64Asset);
                toast.success("Screenshot attached successfully!");
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Attachment failed. Please try again.";
                setUploadError(message);
                toast.error("Attachment failed", { description: message });
            } finally {
                setIsProcessing(false);
            }
        },
        [compressImageToBase64, onUploadComplete],
    );

    const handleFileAccepted = React.useCallback(
        (file: File) => {
            setPreviewUrl(null);
            setStoredAsset(null);
            setUploadError(null);
            void readFileAsBase64(file);
        },
        [readFileAsBase64],
    );

    const handleRemoveImage = () => {
        setPreviewUrl(null);
        setStoredAsset(null);
        setUploadError(null);
        onUploadComplete("");
    };

    const handleCopy = React.useCallback(async (label: "GCash Number" | "Account Name", value?: string | null) => {
        const text = value?.trim();
        if (!text) {
            toast.error(`${label} is not available.`);
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            toast.success(`${label} copied to clipboard.`);
        } catch {
            toast.error(`Failed to copy ${label.toLowerCase()}.`);
        }
    }, []);

    return (
        <div className="space-y-4">
            {/* GCash Payment QR + Instructions */}
            <Card className="gap-3 py-0 border-0 bg-transparent shadow-none md:border-blue-200 md:bg-blue-50/60 md:dark:border-blue-900/50 md:dark:bg-blue-950/20">
                <CardContent className="space-y-3 px-3 pt-0 text-sm md:space-y-4 md:px-6 md:pt-3">
                    <div className="space-y-2 md:space-y-3">
                        <div className="grid gap-1.5 md:grid-cols-2 md:gap-2">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2 rounded-md border border-blue-100 bg-white/80 px-3 py-2 text-sm font-medium text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                                    <p className="min-w-0 truncate">
                                        <span className="font-semibold">GCash Number:</span>{" "}
                                        <span>{gcashNumber?.trim() || "Not configured"}</span>
                                    </p>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => void handleCopy("GCash Number", gcashNumber)}
                                        aria-label="Copy GCash number"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2 rounded-md border border-blue-100 bg-white/80 px-3 py-2 text-sm font-medium text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                                    <p className="min-w-0 truncate">
                                        <span className="font-semibold">Account Name:</span>{" "}
                                        <span>{gcashAccountName?.trim() || "Not configured"}</span>
                                    </p>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => void handleCopy("Account Name", gcashAccountName)}
                                        aria-label="Copy account name"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5 md:space-y-2">
                            <div className="flex justify-center">
                                <div className="overflow-hidden rounded-xl border-2 border-blue-200 bg-white shadow-sm dark:border-blue-800">
                                    {qrImageUrl ? (
                                        <Image
                                            src={qrImageUrl}
                                            alt="GCash Payment QR Code"
                                            width={240}
                                            height={240}
                                            unoptimized
                                            className="h-auto w-full max-w-[240px] object-contain"
                                        />
                                    ) : (
                                        <div className="flex h-[240px] w-[240px] items-center justify-center px-3 text-center text-xs text-muted-foreground">
                                            No GCash QR code available for this show.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1.5 text-[11px]"
                                    onClick={() => setIsQrFullscreenOpen(true)}
                                    disabled={!qrImageUrl}
                                >
                                    <Expand className="h-3.5 w-3.5" />
                                    View full screen
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1.5 text-[11px]"
                                    asChild
                                    disabled={!qrImageUrl}
                                >
                                    <a href={qrImageUrl ?? "#"} download="seatwise-gcash-qr.jpg">
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <ol className="list-decimal space-y-1 pl-4 text-blue-700 dark:text-blue-400 text-xs sm:space-y-1.5 sm:pl-5 sm:text-sm">
                        <li>Scan the QR code above using your <strong>GCash app</strong>.</li>
                        <li>Complete the payment for the total amount shown.</li>
                        <li>Take a <strong>screenshot</strong> of the payment confirmation.</li>
                        <li>Upload the screenshot below to verify your payment.</li>
                    </ol>
                </CardContent>
            </Card>

            <ImageUploadDropzone
                previewUrl={previewUrl}
                previewAlt="GCash receipt preview"
                onFileAccepted={handleFileAccepted}
                onRemove={handleRemoveImage}
                accept={ACCEPTED_TYPES}
                maxSize={MAX_FILE_SIZE}
                disabled={disabled}
                isProcessing={isProcessing}
                processingText="Processing screenshot..."
                uploadError={uploadError}
                onFileRejected={setUploadError}
                idleTitle="Upload GCash Screenshot"
                activeTitle="Drop your screenshot here"
                helperText="Drag and drop or click to browse. JPG, PNG, or WEBP (max 5MB)"
                successMessage={storedAsset ? "Screenshot ready for submission" : null}
                minHeightClassName="min-h-[200px]"
            />

            {onBack && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    disabled={isProcessing}
                    className="w-full"
                >
                    Back to seat selection
                </Button>
            )}

            <Dialog open={isQrFullscreenOpen} onOpenChange={setIsQrFullscreenOpen}>
                <DialogContent
                    className="h-[100dvh] w-[100vw] max-w-none translate-x-[-50%] translate-y-[-50%] rounded-none border-0 bg-black/95 p-0 [&>[data-slot=dialog-close]]:text-white [&>[data-slot=dialog-close]]:opacity-100"
                    showCloseButton
                >
                    <DialogTitle className="sr-only">GCash Payment QR Code</DialogTitle>
                    <div className="flex h-full w-full items-center justify-center p-3 sm:p-6">
                        {qrImageUrl ? (
                            <Image
                                src={qrImageUrl}
                                alt="GCash Payment QR Code"
                                width={1600}
                                height={1600}
                                unoptimized
                                className="max-h-full max-w-full object-contain"
                            />
                        ) : (
                            <p className="text-sm text-white">No GCash QR code available.</p>
                        )}
                    </div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <Button size="sm" variant="secondary" asChild disabled={!qrImageUrl}>
                            <a href={qrImageUrl ?? "#"} download="seatwise-gcash-qr.jpg">
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Download
                            </a>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
