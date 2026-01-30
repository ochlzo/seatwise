"use client";

import * as React from "react";
import Image from "next/image";
import { X, FileText, Upload } from "lucide-react";
import Dropzone, {
  type DropzoneProps,
  type FileRejection,
} from "react-dropzone";

import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { UploadProgress } from "@/components/ui/upload-progress";

interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Value of the uploader.
   * @type File[]
   * @default undefined
   */
  value?: File[];

  /**
   * Function to be called when the value changes.
   * @type (files: File[]) => void
   * @default undefined
   */
  onValueChange?: (files: File[]) => void;

  /**
   * Function to be called when files are uploaded.
   * @type (files: File[]) => Promise<void>
   * @default undefined
   */
  onUpload?: (files: File[]) => Promise<void>;

  /**
   * Progress of the uploaded files.
   * @type Record<string, number> | undefined
   * @default undefined
   */
  progresses?: Record<string, number>;

  /**
   * Accepted file types for the uploader.
   * @type { [key: string]: string[] }
   * @default undefined
   */
  accept?: DropzoneProps["accept"];

  /**
   * Maximum number of files for the uploader.
   * @type number | undefined
   * @default 1
   */
  maxFiles?: number;

  /**
   * Maximum file size for the uploader.
   * @type number | undefined
   * @default 1024 * 1024 * 2 // 2MB
   */
  maxSize?: number;

  /**
   * Whether the uploader should accept multiple files.
   * @type boolean
   * @default false
   */
  multiple?: boolean;

  /**
   * Whether to show the remove button on file cards.
   * @type boolean
   * @default true
   */
  showRemoveButton?: boolean;

  /**
   * Whether the uploader is disabled.
   */
  disabled?: boolean;
}

export function FileUploader(props: FileUploaderProps) {
  const {
    value: valueProp,
    onValueChange,
    onUpload,
    progresses,
    accept = {
      "image/*": [],
    },
    maxFiles = 1,
    maxSize = 1024 * 1024 * 2,
    multiple = false,
    disabled = false,
    showRemoveButton = true,
    className,
    ...dropzoneProps
  } = props;

  const [files, setFiles] = React.useState<File[]>(valueProp ?? []);

  const onDrop = React.useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (!multiple && maxFiles === 1 && acceptedFiles.length === 1) {
        // AUTO-OVERWRITE MODE: replace the current file
        const file = acceptedFiles[0];
        const newFiles = [
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          }),
        ];
        setFiles(newFiles);
        onValueChange?.(newFiles);
        onUpload?.(newFiles);
        return;
      }

      if ((files?.length ?? 0) + acceptedFiles.length > maxFiles) {
        alert(`Cannot upload more than ${maxFiles} files`);
        return;
      }

      const newFiles = acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      );

      const updatedFiles = files ? [...files, ...newFiles] : newFiles;

      setFiles(updatedFiles);
      onValueChange?.(updatedFiles);

      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ file }) => {
          alert(`File ${file.name} was rejected`);
        });
      }

      if (
        onUpload &&
        updatedFiles.length > 0 &&
        updatedFiles.length <= maxFiles
      ) {
        const target =
          updatedFiles.length > 0 ? `${updatedFiles.length} files` : `file`;
        console.log(`Uploading ${target}...`);
        onUpload(updatedFiles);
      }
    },

    [files, maxFiles, multiple, onUpload, onValueChange]
  );

  function onRemove(index: number) {
    if (!files) return;
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onValueChange?.(newFiles);
  }

  // Revoke the data uris to avoid memory leaks
  React.useEffect(() => {
    return () => {
      if (!files) return;
      files.forEach((file) => {
        if ("preview" in file) {
          URL.revokeObjectURL((file as File & { preview: string }).preview);
        }
      });
    };
  }, [files]);

  // Sync with value prop to support controlled mode/resetting
  React.useEffect(() => {
    if (valueProp !== undefined) {
      setFiles(valueProp);
    }
  }, [valueProp]);

  const isDisabled =
    disabled || (maxFiles > 1 && (files?.length ?? 0) >= maxFiles);

  // Calculate aggregate progress for the UploadProgress component
  const totalProgress = React.useMemo(() => {
    if (!progresses || Object.keys(progresses).length === 0) return 0;
    const values = Object.values(progresses);
    return Math.floor(
      values.reduce((acc, curr) => acc + curr, 0) / values.length
    );
  }, [progresses]);

  // Determine if the upload progress dialog should be open
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);

  React.useEffect(() => {
    const progressValues = progresses ? Object.values(progresses) : [];
    const hasActiveUploads = progressValues.some((p) => p < 100);
    const allCompleted =
      progressValues.length > 0 && progressValues.every((p) => p === 100);

    if (hasActiveUploads) {
      setIsUploadDialogOpen(true);
    } else if (allCompleted && totalProgress === 100) {
      // Auto close after 800ms to match the UploadProgress internal timer
      const timer = setTimeout(() => {
        setIsUploadDialogOpen(false);
      }, 900); // Slightly longer than the internal dialog's 800ms
      return () => clearTimeout(timer);
    } else if (progressValues.length === 0) {
      // If progresses is cleared/empty, ensure the dialog is closed immediately
      setIsUploadDialogOpen(false);
    }
  }, [progresses, totalProgress]);

  return (
    <div className="relative flex flex-col gap-2 overflow-hidden">
      <UploadProgress
        isOpen={isUploadDialogOpen}
        totalProgress={totalProgress}
        files={files.map((f) => ({ name: f.name, size: f.size }))}
        onDone={() => setIsUploadDialogOpen(false)}
      />
      <Dropzone
        onDrop={onDrop}
        accept={accept}
        maxSize={maxSize}
        maxFiles={maxFiles}
        multiple={multiple}
        disabled={isDisabled}
      >
        {({ getRootProps, getInputProps, isDragActive }) => (
          <div
            {...getRootProps()}
            className={cn(
              "group relative grid h-32 md:h-52 w-full cursor-pointer place-items-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-5 py-2.5 text-center transition hover:bg-muted/25",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isDragActive && "border-primary",
              isDisabled && "pointer-events-none opacity-60",
              className
            )}
            {...dropzoneProps}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                <div className="rounded-full border border-dashed p-2 md:p-3">
                  <Upload
                    className="size-5 md:size-7 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-medium text-muted-foreground">
                  Drop the files here
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
                <div className="rounded-full border border-dashed p-2 md:p-3">
                  <Upload
                    className="size-5 md:size-7 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-px">
                  <p className="text-sm md:text-base font-medium text-muted-foreground">
                    Drag &apos;n &apos;drop files here, or click to select files
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground/70">
                    You can upload
                    {maxFiles > 1
                      ? ` up to ${maxFiles} files (up to ${formatBytes(
                        maxSize
                      )} each)`
                      : ` a file with size up to ${formatBytes(maxSize)}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Dropzone>
      {files?.length ? (
        <div className="h-fit max-h-48 w-full overflow-y-auto space-y-2">
          {files?.map((file, index) => (
            <FileCard
              key={index}
              file={file}
              onRemove={() => onRemove(index)}
              showRemoveButton={showRemoveButton}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface FileImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

export function FileImagePreview({
  src,
  alt,
  className,
  width = 40,
  height = 40,
}: FileImagePreviewProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      className={cn(
        "aspect-square size-8 md:size-12 shrink-0 rounded-md object-cover",
        className
      )}
    />
  );
}

interface FileCardProps {
  file: File;
  onRemove: () => void;
  showRemoveButton?: boolean;
}

function FileCard({ file, onRemove, showRemoveButton = true }: FileCardProps) {
  return (
    <div className="relative flex items-center space-x-2 md:space-x-4">
      <div className="flex flex-1 items-center space-x-4 min-w-0">
        {isFileWithPreview(file) ? (
          <FileImagePreview src={file.preview} alt={file.name} />
        ) : (
          <div className="flex size-8 md:size-10 items-center justify-center rounded-md bg-muted/20 shrink-0">
            <FileText
              className="size-4 md:size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        )}
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <div className="space-y-px">
            <p className="truncate text-xs md:text-sm font-medium text-foreground/80">
              {file.name}
            </p>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </p>
          </div>
        </div>
      </div>
      {showRemoveButton && (
        <div className="flex items-center shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11" // Mobile-first touch target 44px
            onClick={onRemove}
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Remove file</span>
          </Button>
        </div>
      )}
    </div>
  );
}

function isFileWithPreview(file: File): file is File & { preview: string } {
  return "preview" in file && typeof (file as File & { preview: string }).preview === "string";
}
