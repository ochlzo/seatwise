"use client";

import React from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { loadSeatmap, fitView } from "@/lib/features/seatmap/seatmapSlice";
import { UploadProgress } from "@/components/ui/upload-progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, ChevronDown, FileCode, FileImage } from "lucide-react";
import { calculateFitViewport } from "@/lib/seatmap/view-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
    const [isCategoryWarningOpen, setIsCategoryWarningOpen] = React.useState(false);

    const hasUnassignedSeats = React.useMemo(() => {
        return Object.values(seatmap.nodes).some((node) => {
            return node.type === "seat" && !("categoryId" in node && node.categoryId);
        });
    }, [seatmap.nodes]);

    // Listen for PNG export completion from Canvas
    React.useEffect(() => {
        const handleSuccess = (e: any) => {
            if (e.detail?.type === "png") {
                setProgress(100); // Complete the progress bar
            }
        };
        window.addEventListener("seatmap-export-success" as any, handleSuccess);
        return () => window.removeEventListener("seatmap-export-success" as any, handleSuccess);
    }, []);

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

    const handleExport = (type: "json" | "png") => {
        if (type === "json" && hasUnassignedSeats) {
            setIsCategoryWarningOpen(true);
            return;
        }
        setActionType("export");
        const baseFileName = seatmap.title.toLowerCase().replace(/\s+/g, "-");
        const fileName = type === "json" ? `${baseFileName}.json` : `${baseFileName}.png`;

        setIsProgressOpen(true);
        setProgress(0);

        if (type === "json") {
            const targetViewport = calculateFitViewport(seatmap.nodes, seatmap.viewportSize);

            const exportData = {
                title: seatmap.title,
                nodes: seatmap.nodes,
                categories: seatmap.categories,
                viewport: targetViewport,
                snapSpacing: seatmap.snapSpacing,
                exportedAt: new Date().toISOString(),
            };
            const jsonString = JSON.stringify(exportData, null, 2);
            const fileSize = new Blob([jsonString]).size;
            setImportFiles([{ name: fileName, size: fileSize }]);

            dispatch(fitView());

            // Simulate progress for JSON
            let currentProgress = 0;
            const interval = setInterval(() => {
                currentProgress += Math.floor(Math.random() * 20) + 15;
                if (currentProgress >= 95) {
                    clearInterval(interval);
                    setProgress(100);

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
        } else {
            dispatch(fitView());

            // PNG Export - approximate size check won't work perfectly before capture
            setImportFiles([{ name: fileName, size: 0 }]);

            // Start progress dial
            let currentProgress = 0;
            const interval = setInterval(() => {
                currentProgress += 5;
                if (currentProgress >= 85) {
                    clearInterval(interval);
                    // Trigger the actual PNG capture from Canvas
                    window.dispatchEvent(new CustomEvent("seatmap-export-png", { detail: { fileName } }));
                } else {
                    setProgress(currentProgress);
                }
            }, 50);
        }
    };

    const isMobile = useIsMobile();

    return (
        <div className={cn(
            "flex items-center gap-2",
            !isMobile && "border-l border-zinc-200 dark:border-zinc-800 pl-4 ml-2"
        )}>
            <Dialog open={isOverwriteDialogOpen} onOpenChange={setIsOverwriteDialogOpen}>
                <DialogContent className={isMobile ? "w-[95vw] rounded-2xl" : ""}>
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
                    <DialogFooter className="mt-4 gap-2 flex-col sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsOverwriteDialogOpen(false);
                                setPendingFile(null);
                            }}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmOverwrite}
                            className="w-full sm:w-auto"
                        >
                            Confirm Overwrite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isCategoryWarningOpen} onOpenChange={setIsCategoryWarningOpen}>
                <DialogContent className={isMobile ? "w-[95vw] rounded-2xl" : ""}>
                    <DialogHeader>
                        <DialogTitle>Unassigned Seats Detected</DialogTitle>
                        <DialogDescription>
                            Some seats do not have a category yet. Assign categories before exporting to JSON. (e.g., Regular).
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button onClick={() => setIsCategoryWarningOpen(false)}>Close</Button>
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
                    loading: actionType === "import" ? "Configuring layout and nodes..." : "Processing export assets...",
                    success: actionType === "import" ? "Your seatmap has been loaded successfully." : "Your seatmap has been exported successfully.",
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
                size={isMobile ? "icon" : "sm"}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 md:gap-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                title="Import JSON"
            >
                <Upload className="w-3.5 h-3.5" />
                {!isMobile && <span>Import JSON</span>}
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="default"
                        size={isMobile ? "icon" : "sm"}
                        className="h-8 md:gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-sm"
                        title="Export Options"
                    >
                        <Download className="w-3.5 h-3.5" />
                        {!isMobile && (
                            <>
                                <span>Export Options</span>
                                <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                            </>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                    <DropdownMenuItem onClick={() => handleExport("json")} className="gap-2 cursor-pointer">
                        <FileCode className="w-4 h-4 text-blue-500" />
                        <span>Export as JSON</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("png")} className="gap-2 cursor-pointer">
                        <FileImage className="w-4 h-4 text-purple-500" />
                        <span>Export as PNG</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
