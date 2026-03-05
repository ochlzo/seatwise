"use client";

import * as React from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { Upload, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageUploadDropzoneProps = {
  previewUrl: string | null;
  previewAlt: string;
  onFileAccepted: (file: File) => void;
  onRemove: () => void;
  accept: Accept;
  maxSize: number;
  disabled?: boolean;
  isProcessing?: boolean;
  processingText?: string;
  uploadError?: string | null;
  onFileRejected?: (message: string) => void;
  idleTitle: string;
  activeTitle: string;
  helperText: string;
  successMessage?: string | null;
  emptyHint?: string;
  minHeightClassName?: string;
  previewMaxHeightClassName?: string;
  showRemoveButton?: boolean;
};

export function ImageUploadDropzone({
  previewUrl,
  previewAlt,
  onFileAccepted,
  onRemove,
  accept,
  maxSize,
  disabled = false,
  isProcessing = false,
  processingText = "Processing image...",
  uploadError,
  onFileRejected,
  idleTitle,
  activeTitle,
  helperText,
  successMessage,
  emptyHint,
  minHeightClassName = "min-h-[170px]",
  previewMaxHeightClassName = "max-h-[300px]",
  showRemoveButton = true,
}: ImageUploadDropzoneProps) {
  const [localRejectionError, setLocalRejectionError] = React.useState<string | null>(null);

  const onDrop = React.useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (rejectedFiles.length > 0) {
        const firstRejection = rejectedFiles[0];
        const errorMsg = firstRejection.errors.map((e) => e.message).join(", ");
        setLocalRejectionError(errorMsg);
        onFileRejected?.(errorMsg);
        return;
      }

      if (acceptedFiles.length === 0) return;

      setLocalRejectionError(null);
      onFileRejected?.("");
      onFileAccepted(acceptedFiles[0]);
    },
    [onFileAccepted, onFileRejected],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: disabled || isProcessing,
  });

  const effectiveError = uploadError || localRejectionError;

  return (
    <div className="space-y-3">
      {!previewUrl ? (
        <div
          {...getRootProps()}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-all duration-200",
            minHeightClassName,
            isDragActive
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
              : "border-sidebar-border/70 bg-muted/20 hover:border-blue-400 hover:bg-muted/40",
            (disabled || isProcessing) && "pointer-events-none opacity-50",
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-muted/60 p-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{isDragActive ? activeTitle : idleTitle}</p>
              <p className="text-xs text-muted-foreground">{helperText}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="group relative rounded-xl border border-sidebar-border/70 bg-muted/10 p-3">
          {isProcessing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/80 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-center text-xs text-muted-foreground">{processingText}</p>
            </div>
          )}

          <div className="relative flex items-center justify-center">
            <img src={previewUrl} alt={previewAlt} className={cn("rounded-lg object-contain", previewMaxHeightClassName)} />
            {!isProcessing && showRemoveButton && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 rounded-full opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {successMessage && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{successMessage}</span>
            </div>
          )}
        </div>
      )}

      {effectiveError && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{effectiveError}</span>
        </div>
      )}

      {!previewUrl && !effectiveError && emptyHint && (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  );
}

