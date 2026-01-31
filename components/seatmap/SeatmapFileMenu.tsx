"use client";

import React from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Download, Upload, Save, FileCode, FileImage, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { loadSeatmap, fitView, markSeatmapDirty, markSeatmapSaved } from "@/lib/features/seatmap/seatmapSlice";
import { UploadProgress } from "@/components/ui/upload-progress";
import { saveSeatmapTemplateAction } from "@/lib/actions/saveSeatmapTemplate";
import { useSearchParams, useRouter } from "next/navigation";
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
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle } from "lucide-react";
import { calculateFitViewport } from "@/lib/seatmap/view-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function SeatmapFileMenu() {
    const dispatch = useAppDispatch();
    const seatmap = useAppSelector((state) => state.seatmap);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isProgressOpen, setIsProgressOpen] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [importFiles, setImportFiles] = React.useState<{ name: string; size: number }[]>([]);
    const [actionType, setActionType] = React.useState<"import" | "export" | "save">("import");

    const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = React.useState(false);
    const [pendingFile, setPendingFile] = React.useState<File | null>(null);

    const [isConflictDialogOpen, setIsConflictDialogOpen] = React.useState(false);
    const [conflictDetails, setConflictDetails] = React.useState<{
        showName: string;
        showStatus: string;
        message: string;
    } | null>(null);

    const searchParams = useSearchParams();
    const router = useRouter();
    const seatmapId = searchParams.get("seatmapId") ?? undefined;

    const handleSaveToTemplates = async (forceDuplicate = false) => {
        const name = seatmap.title?.trim();
        if (!name) {
            toast.error("Seatmap name is required.");
            return;
        }

        // Check if canvas is empty
        if (Object.keys(seatmap.nodes).length === 0) {
            toast.error("Cannot save an empty seatmap. Please add some seats or shapes first.");
            return;
        }

        // Check for seats without seat numbers
        const seats = Object.values(seatmap.nodes).filter((node) => node.type === "seat");
        const seatsWithoutNumbers = seats.filter(
            (seat) => seat.seatNumber === undefined || seat.seatNumber === null
        );
        if (seatsWithoutNumbers.length > 0) {
            toast.error(
                `${seatsWithoutNumbers.length} seat(s) don't have seat numbers assigned. Please assign seat numbers before saving.`
            );
            return;
        }

        setActionType("save");
        setIsProgressOpen(true);
        setProgress(0);

        const finalName = forceDuplicate ? `${name} - Copy` : name;
        const exportData = {
            title: finalName,
            nodes: seatmap.nodes,
            viewport: calculateFitViewport(seatmap.nodes, seatmap.viewportSize),
            snapSpacing: seatmap.snapSpacing,
            exportedAt: new Date().toISOString(),
        };

        const jsonString = JSON.stringify(exportData);
        const fileSize = new Blob([jsonString]).size;
        setImportFiles([{ name: `${finalName}.json`, size: fileSize }]);

        setProgress(15);

        try {
            const result = await saveSeatmapTemplateAction({
                seatmap_name: finalName,
                seatmap_json: exportData,
                seatmap_id: forceDuplicate ? undefined : seatmapId, // Don't pass ID if duplicating
            });

            if (!result.success) {
                // Check if it's a conflict error
                if (result.error === "SEATMAP_IN_USE" && result.conflictDetails) {
                    setIsProgressOpen(false);
                    setConflictDetails(result.conflictDetails);
                    setIsConflictDialogOpen(true);
                    return;
                }
                throw new Error(result.error || "Failed to save seatmap");
            }

            setProgress(100);
            if (forceDuplicate) {
                toast.success(`Seatmap duplicated as "${finalName}".`);
                // Update URL to the new seatmap ID
                if (result.seatmapId) {
                    router.replace(`/seat-builder?seatmapId=${result.seatmapId}`);
                }
            } else {
                toast.success(seatmapId ? "Seatmap updated." : "Seatmap saved to templates.");
            }
            dispatch(markSeatmapSaved());
        } catch (error: unknown) {
            console.error(error);
            setIsProgressOpen(false);
            const message = error instanceof Error ? error.message : "Failed to save seatmap";
            toast.error(message);
        }
    };

    const handleDuplicateConfirm = () => {
        setIsConflictDialogOpen(false);
        setConflictDetails(null);
        handleSaveToTemplates(true);
    };

    // Listen for PNG export completion from Canvas
    React.useEffect(() => {
        const handleSuccess = (e: Event) => {
            const event = e as CustomEvent<{ type?: string }>;
            if (event.detail?.type === "png") {
                setProgress(100); // Complete the progress bar
            }
        };
        window.addEventListener("seatmap-export-success", handleSuccess as EventListener);
        return () => window.removeEventListener("seatmap-export-success", handleSuccess as EventListener);
    }, [dispatch]);

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
                        dispatch(markSeatmapDirty());
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
        // Check if canvas is empty
        if (Object.keys(seatmap.nodes).length === 0) {
            toast.error("Cannot export an empty seatmap. Please add some seats or shapes first.");
            return;
        }

        // Check for seats without seat numbers
        const seats = Object.values(seatmap.nodes).filter((node) => node.type === "seat");
        const seatsWithoutNumbers = seats.filter(
            (seat) => seat.seatNumber === undefined || seat.seatNumber === null
        );
        if (seatsWithoutNumbers.length > 0) {
            toast.error(
                `${seatsWithoutNumbers.length} seat(s) don't have seat numbers assigned. Please assign seat numbers before exporting.`
            );
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
            // PNG Export
            setImportFiles([{ name: fileName, size: 0 }]);

            // Dispatch fitView first
            dispatch(fitView());

            // Start progress dial
            let currentProgress = 0;
            const interval = setInterval(() => {
                currentProgress += 3;
                if (currentProgress >= 70) {
                    clearInterval(interval);
                    setProgress(70);

                    // Wait for fitView to complete (viewport animation takes ~200-300ms)
                    setTimeout(() => {
                        // Use requestAnimationFrame to ensure canvas has rendered the new viewport
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                // Trigger the actual PNG capture from Canvas
                                window.dispatchEvent(new CustomEvent("seatmap-export-png", { detail: { fileName } }));

                                // Continue progress to 85% while PNG is being generated
                                setProgress(85);
                            });
                        });
                    }, 300); // Wait 300ms for fitView animation to complete
                } else {
                    setProgress(currentProgress);
                }
            }, 50);
        }
    };

    const isMobile = useIsMobile();

    return (
        <>
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

            {/* Conflict Dialog - Seatmap in Use */}
            <Dialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
                <DialogContent className={isMobile ? "w-[95vw] rounded-2xl" : ""}>
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-red-100 p-2 text-red-600">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <DialogTitle>Seatmap Currently In Use</DialogTitle>
                        </div>
                        <DialogDescription className="pt-2">
                            {conflictDetails?.message}
                            <br /><br />
                            <strong>Would you like to save your changes as a new template instead?</strong>
                            <br />
                            Your seatmap will be duplicated with &quot; - Copy&quot; appended to the name.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 gap-2 flex-col sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsConflictDialogOpen(false);
                                setConflictDetails(null);
                            }}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleDuplicateConfirm}
                            className="w-full sm:w-auto"
                        >
                            Duplicate as New Template
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
                    loading: actionType === "import" ? "Importing Seatmap" : actionType === "export" ? "Exporting Seatmap" : "Saving Template",
                    success: actionType === "import" ? "Import Complete" : actionType === "export" ? "Export Complete" : "Template Saved",
                }}
                description={{
                    loading: actionType === "import" ? "Configuring layout and nodes..." : actionType === "export" ? "Processing export assets..." : "Saving to templates...",
                    success: actionType === "import" ? "Your seatmap has been loaded successfully." : actionType === "export" ? "Your seatmap has been exported successfully." : "Template saved successfully.",
                }}
            />
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".json"
                className="hidden"
            />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            "h-8 gap-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                            isMobile && "px-2"
                        )}
                    >
                        <span className={cn(isMobile && "text-xs")}>File</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            onClick={() => fileInputRef.current?.click()}
                            className="gap-2 cursor-pointer"
                        >
                            <Upload className="w-4 h-4 text-blue-500" />
                            <span>Import JSON</span>
                        </DropdownMenuItem>

                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="gap-2">
                                <Download className="w-4 h-4 text-green-500" />
                                <span>Export Options</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem
                                        onClick={() => handleExport("json")}
                                        className="gap-2 cursor-pointer"
                                    >
                                        <FileCode className="w-4 h-4 text-blue-500" />
                                        <span>Export as JSON</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleExport("png")}
                                        className="gap-2 cursor-pointer"
                                    >
                                        <FileImage className="w-4 h-4 text-purple-500" />
                                        <span>Export as PNG</span>
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={() => handleSaveToTemplates()}
                            className="gap-2 cursor-pointer"
                        >
                            <Save className="w-4 h-4 text-amber-500" />
                            <span>Save to Templates</span>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
