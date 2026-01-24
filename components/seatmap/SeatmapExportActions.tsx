"use client";

import React from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { loadSeatmap } from "@/lib/features/seatmap/seatmapSlice";
import { UploadProgress } from "@/components/ui/upload-progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

export function SeatmapExportActions() {
    const dispatch = useAppDispatch();
    const seatmap = useAppSelector((state) => state.seatmap);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isProgressOpen, setIsProgressOpen] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [importFiles, setImportFiles] = React.useState<{ name: string; size: number }[]>([]);
    const [actionType, setActionType] = React.useState<"import" | "export">("import");

    const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = React.useState(false);
    const [pendingFile, setPendingFile] = React.useState<File | null>(null);

    const startImport = (file: File) => {
        setActionType("import");
        setImportFiles([{ name: file.name, size: file.size }]);
        setIsProgressOpen(true);
        setProgress(0);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);

                // Simulate progress
                let currentProgress = 0;
                const interval = setInterval(() => {
                    currentProgress += Math.floor(Math.random() * 20) + 10;
                    if (currentProgress >= 95) {
                        clearInterval(interval);
                        setProgress(100);
                        dispatch(loadSeatmap(json));
                    } else {
                        setProgress(currentProgress);
                    }
                }, 150);

            } catch (error) {
                console.error("Failed to parse JSON:", error);
                setIsProgressOpen(false);
                toast.error("Failed to import: Invalid JSON file.");
            }
        };
        reader.readAsText(file);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const hasNodes = Object.keys(seatmap.nodes).length > 0;

        if (hasNodes) {
            setPendingFile(file);
            setIsOverwriteDialogOpen(true);
        } else {
            startImport(file);
        }

        // Reset input
        event.target.value = "";
    };

    const confirmOverwrite = () => {
        if (pendingFile) {
            startImport(pendingFile);
            setPendingFile(null);
        }
        setIsOverwriteDialogOpen(false);
    };

    const handleDownload = () => {
        setActionType("export");
        const exportData = {
            title: seatmap.title,
            nodes: seatmap.nodes,
            categories: seatmap.categories,
            viewport: seatmap.viewport,
            snapSpacing: seatmap.snapSpacing,
            exportedAt: new Date().toISOString(),
        };

        const fileName = `${seatmap.title.toLowerCase().replace(/\s+/g, "-")}.json`;
        const jsonString = JSON.stringify(exportData, null, 2);
        const fileSize = new Blob([jsonString]).size;

        setImportFiles([{ name: fileName, size: fileSize }]);
        setIsProgressOpen(true);
        setProgress(0);

        // Simulate progress
        let currentProgress = 0;
        const interval = setInterval(() => {
            currentProgress += Math.floor(Math.random() * 20) + 15;
            if (currentProgress >= 95) {
                clearInterval(interval);
                setProgress(100);

                // Trigger download
                const blob = new Blob([jsonString], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                setProgress(currentProgress);
            }
        }, 120);
    };

    return (
        <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-4 ml-2">
            <Dialog open={isOverwriteDialogOpen} onOpenChange={setIsOverwriteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-amber-100 p-2 text-amber-600">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <DialogTitle>Overwrite Current Work?</DialogTitle>
                        </div>
                        <DialogDescription className="pt-2">
                            Importing a new seatmap will permanently delete all current seats, shapes, and progress. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsOverwriteDialogOpen(false);
                                setPendingFile(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmOverwrite}
                        >
                            Confirm Overwrite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <UploadProgress
                isOpen={isProgressOpen}
                totalProgress={progress}
                files={importFiles}
                onDone={() => setIsProgressOpen(false)}
                title={{
                    loading: actionType === "import" ? "Importing Seatmap" : "Exporting Seatmap",
                    success: actionType === "import" ? "Import Complete" : "Export Complete",
                }}
                description={{
                    loading: actionType === "import" ? "Configuring layout and nodes..." : "Generating JSON bundle...",
                    success: actionType === "import" ? "Your seatmap has been loaded successfully." : "Your seatmap has been exported as JSON.",
                }}
            />
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".json"
                className="hidden"
            />
            <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 gap-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
            </Button>
            <Button
                variant="default"
                size="sm"
                onClick={handleDownload}
                className="h-8 gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-sm"
            >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
            </Button>
        </div>
    );
}
