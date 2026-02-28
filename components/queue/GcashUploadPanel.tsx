"use client";

import * as React from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, X, Loader2, AlertCircle, CheckCircle2, Expand, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES: Record<string, string[]> = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
};

type GcashUploadPanelProps = {
    onUploadComplete: (url: string) => void;
    onBack?: () => void;
    disabled?: boolean;
};

export function GcashUploadPanel({
    onUploadComplete,
    onBack,
    disabled = false,
}: GcashUploadPanelProps) {
    const [isQrFullscreenOpen, setIsQrFullscreenOpen] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [storedAsset, setStoredAsset] = React.useState<string | null>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);

    const readFileAsBase64 = React.useCallback(
        async (file: File) => {
            setIsProcessing(true);
            setUploadError(null);

            try {
                const base64Asset = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        if (typeof reader.result === "string") {
                            resolve(reader.result);
                            return;
                        }
                        reject(new Error("Failed to read screenshot"));
                    };
                    reader.onerror = () => reject(new Error("Failed to read screenshot"));
                    reader.readAsDataURL(file);
                });

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
            setPreviewUrl(null);
            setStoredAsset(null);
            setUploadError(null);

            void readFileAsBase64(file);
        },
        [readFileAsBase64],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: ACCEPTED_TYPES,
        maxSize: MAX_FILE_SIZE,
        multiple: false,
        disabled: disabled || isProcessing,
    });

    const handleRemoveImage = () => {
        setPreviewUrl(null);
        setStoredAsset(null);
        setUploadError(null);
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

                    <div className="flex items-center justify-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 text-[11px]"
                            onClick={() => setIsQrFullscreenOpen(true)}
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
                        >
                            <a href="/gcashimage/gcashpayment.jpg" download="seatwise-gcash-qr.jpg">
                                <Download className="h-3.5 w-3.5" />
                                Download
                            </a>
                        </Button>
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
            ${(disabled || isProcessing) ? "pointer-events-none opacity-50" : ""}
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
                    {isProcessing && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/80 backdrop-blur-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            <p className="text-center text-xs text-muted-foreground">
                                Processing screenshot...
                            </p>
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
                        {!isProcessing && (
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
                    {storedAsset && (
                        <div className="mt-2 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>Screenshot ready for submission</span>
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
                        <img
                            src="/gcashimage/gcashpayment.jpg"
                            alt="GCash Payment QR Code"
                            className="max-h-full max-w-full object-contain"
                        />
                    </div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <Button size="sm" variant="secondary" asChild>
                            <a href="/gcashimage/gcashpayment.jpg" download="seatwise-gcash-qr.jpg">
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
