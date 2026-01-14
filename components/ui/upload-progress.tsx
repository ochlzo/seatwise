"use client"

import * as React from "react"
import { CheckCircle2, FileIcon, Loader2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn, formatBytes, truncateText } from "@/lib/utils"

interface UploadProgressProps {
    isOpen: boolean
    totalProgress: number
    files: { name: string; size: number }[]
    onDone?: () => void
}

export function UploadProgress({
    isOpen,
    totalProgress,
    files,
    onDone,
}: UploadProgressProps) {
    const isComplete = totalProgress === 100

    React.useEffect(() => {
        if (isComplete && onDone) {
            const timer = setTimeout(() => {
                onDone()
            }, 800)
            return () => clearTimeout(timer)
        }
    }, [isComplete, onDone])

    return (
        <Dialog open={isOpen}>
            <DialogContent
                className="sm:max-w-md"
                showCloseButton={false}
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        {isComplete ? (
                            <div className="rounded-full bg-green-100 p-2 text-green-600">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        ) : (
                            <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        )}
                        <div>
                            <DialogTitle className="text-lg font-bold font-brand">
                                {isComplete ? "Success!" : "Uploading Assets"}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                {isComplete
                                    ? "Your profile has been updated successfully."
                                    : "Please keep this window open until we finish."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Aggregate Progress Bar */}
                    <div className="space-y-2 w-full min-w-0">
                        <div className="flex justify-between text-xs font-semibold">
                            <span>Overall Progress</span>
                            <span className={cn(isComplete ? "text-green-600" : "text-[#3b82f6]")}>
                                {totalProgress}%
                            </span>
                        </div>
                        <Progress
                            value={totalProgress}
                            className="h-3"
                            indicatorClassName={cn(isComplete ? "bg-green-600" : "bg-[#3b82f6]")}
                        />
                    </div>

                    {/* File List */}
                    <div className="max-h-[180px] overflow-y-auto px-1 pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/10 scrollbar-track-transparent">
                        <div className="space-y-2 pb-2">
                            {files.map((file, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-3 rounded-xl border bg-muted/30 p-2.5 md:p-3 transition-colors hover:bg-muted/50"
                                >
                                    <div className="rounded-lg bg-background p-2 shadow-sm shrink-0">
                                        <FileIcon className="h-4 w-4 md:h-5 md:w-5 text-[#3b82f6]" />
                                    </div>
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        <p className="truncate block w-full text-xs md:text-sm font-semibold text-foreground/90">{truncateText(file.name, 42)}</p>
                                        <p className="text-[10px] md:text-xs text-muted-foreground font-medium">{formatBytes(file.size)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

