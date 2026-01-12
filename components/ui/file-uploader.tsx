"use client"

import * as React from "react"
import Image from "next/image"
import { X, FileText, Upload } from "lucide-react"
import Dropzone, {
    type DropzoneProps,
    type FileRejection,
} from "react-dropzone"

import { cn, formatBytes } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { UploadProgress } from "@/components/ui/upload-progress"

interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Value of the uploader.
     * @type File[]
     * @default undefined
     */
    value?: File[]

    /**
     * Function to be called when the value changes.
     * @type (files: File[]) => void
     * @default undefined
     */
    onValueChange?: (files: File[]) => void

    /**
     * Function to be called when files are uploaded.
     * @type (files: File[]) => Promise<void>
     * @default undefined
     */
    onUpload?: (files: File[]) => Promise<void>

    /**
     * Progress of the uploaded files.
     * @type Record<string, number> | undefined
     * @default undefined
     */
    progresses?: Record<string, number>

    /**
     * Accepted file types for the uploader.
     * @type { [key: string]: string[] }
     * @default undefined
     */
    accept?: DropzoneProps["accept"]

    /**
     * Maximum number of files for the uploader.
     * @type number | undefined
     * @default 1
     */
    maxFiles?: number

    /**
     * Maximum file size for the uploader.
     * @type number | undefined
     * @default 1024 * 1024 * 2 // 2MB
     */
    maxSize?: number

    /**
     * Whether the uploader should accept multiple files.
     * @type boolean
     * @default false
     */
    multiple?: boolean

    /**
     * Whether the uploader is disabled.
     * @type boolean
     * @default false
     */
    disabled?: boolean
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
        className,
        ...dropzoneProps
    } = props

    const [files, setFiles] = React.useState<File[]>(valueProp ?? [])

    const onDrop = React.useCallback(
        (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
            if (!multiple && acceptedFiles.length > 1) {
                alert("Cannot upload more than 1 file at a time")
                return
            }

            if ((files?.length ?? 0) + acceptedFiles.length > maxFiles) {
                alert(`Cannot upload more than ${maxFiles} files`)
                return
            }

            const newFiles = acceptedFiles.map((file) =>
                Object.assign(file, {
                    preview: URL.createObjectURL(file),
                })
            )

            const updatedFiles = files ? [...files, ...newFiles] : newFiles

            setFiles(updatedFiles)
            onValueChange?.(updatedFiles)

            if (rejectedFiles.length > 0) {
                rejectedFiles.forEach(({ file }) => {
                    alert(`File ${file.name} was rejected`)
                })
            }

            if (
                onUpload &&
                updatedFiles.length > 0 &&
                updatedFiles.length <= maxFiles
            ) {
                const target = updatedFiles.length > 0 ? `${updatedFiles.length} files` : `file`
                console.log(`Uploading ${target}...`)
                onUpload(updatedFiles)
            }
        },

        [files, maxFiles, multiple, onUpload, onValueChange]
    )

    function onRemove(index: number) {
        if (!files) return
        const newFiles = files.filter((_, i) => i !== index)
        setFiles(newFiles)
        onValueChange?.(newFiles)
    }

    // Revoke the data uris to avoid memory leaks
    React.useEffect(() => {
        return () => {
            if (!files) return
            files.forEach((file) => {
                if ("preview" in file) {
                    URL.revokeObjectURL((file as any).preview)
                }
            })
        }
    }, [])

    const isDisabled = disabled || (files?.length ?? 0) >= maxFiles

    // Calculate aggregate progress for the UploadProgress component
    const totalProgress = React.useMemo(() => {
        if (!progresses || Object.keys(progresses).length === 0) return 0
        const values = Object.values(progresses)
        return Math.floor(values.reduce((acc, curr) => acc + curr, 0) / values.length)
    }, [progresses])

    // Determine if the upload progress dialog should be open
    const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false)

    React.useEffect(() => {
        const hasActiveUploads = progresses && Object.values(progresses).some(p => p < 100)
        if (hasActiveUploads) {
            setIsUploadDialogOpen(true)
        }
    }, [progresses])

    return (
        <div className="relative flex flex-col gap-6 overflow-hidden">
            <UploadProgress
                isOpen={isUploadDialogOpen}
                totalProgress={totalProgress}
                files={files.map(f => ({ name: f.name, size: f.size }))}
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
                                        Drag {' '}'n{' '} 'drop files here, or click to select files
                                    </p>
                                    <p className="text-xs md:text-sm text-muted-foreground/70">
                                        You can upload
                                        {maxFiles > 1
                                            ? ` up to ${maxFiles} files (up to ${formatBytes(maxSize)} each)`
                                            : ` a file with size up to ${formatBytes(maxSize)}`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Dropzone>
            {files?.length ? (
                <div className="h-fit max-h-48 w-full overflow-y-auto space-y-4">
                    {files?.map((file, index) => (
                        <FileCard
                            key={index}
                            file={file}
                            onRemove={() => onRemove(index)}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    )
}

interface FileCardProps {
    file: File
    onRemove: () => void
}

function FileCard({ file, onRemove }: FileCardProps) {
    return (
        <div className="relative flex items-center space-x-2 md:space-x-4 pr-10 md:pr-12">
            <div className="flex flex-1 items-center space-x-4">
                {isFileWithPreview(file) ? (
                    <Image
                        src={file.preview}
                        alt={file.name}
                        width={40}
                        height={40}
                        loading="lazy"
                        className="aspect-square size-8 md:size-12 shrink-0 rounded-md object-cover"
                    />
                ) : (
                    <div className="flex size-8 md:size-10 items-center justify-center rounded-md bg-muted/20">
                        <FileText
                            className="size-4 md:size-5 text-muted-foreground"
                            aria-hidden="true"
                        />
                    </div>
                )}
                <div className="flex w-full flex-col gap-2">
                    <div className="space-y-px">
                        <p className="line-clamp-1 text-xs md:text-sm font-medium text-foreground/80">
                            {file.name}
                        </p>
                        <p className="text-[10px] md:text-xs text-muted-foreground">
                            {formatBytes(file.size)}
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={onRemove}
                >
                    <X className="size-4" aria-hidden="true" />
                    <span className="sr-only">Remove file</span>
                </Button>
            </div>
        </div>
    )
}

function isFileWithPreview(file: File): file is File & { preview: string } {
    return "preview" in file && typeof (file as any).preview === "string"
}
