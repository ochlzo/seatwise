"use client";

import { createPortal } from "react-dom";
import { useRef, useEffect, useState } from "react";
import { ChevronLeft, Plus, Loader2, ArrowLeft } from "lucide-react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { compressImage } from "@/lib/utils/image";
// import { uploadCustomAvatarAction } from "@/lib/actions/uploadCustomAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileUploader } from "@/components/ui/file-uploader";
import { UploadProgress } from "@/components/ui/upload-progress";



interface AvatarSelectProps {
    onClose: () => void;
    onSelect: (avatarUrl: string, isCustom: boolean) => void;
    currentAvatar?: string;
    presetAvatars: string[];
    isSaving?: boolean;
}

export function AvatarSelect({ onClose, onSelect, currentAvatar, presetAvatars, isSaving }: AvatarSelectProps) {
    const [selected, setSelected] = useState(currentAvatar || presetAvatars[0] || "");
    const [stagedBase64, setStagedBase64] = useState<string | null>(null);
    const [stagedFile, setStagedFile] = useState<{ name: string; size: number } | null>(null);
    const [uploaderFiles, setUploaderFiles] = useState<File[]>([]);
    const [mounted, setMounted] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processProgress, setProcessProgress] = useState<number>(0);
    const [saveProgress, setSaveProgress] = useState<number>(0);
    const [showUploader, setShowUploader] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Prevent scrolling on the body when the overlay is open
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "unset";
        };
    }, []);

    // Effect to handle simulated save progress when isSaving changes to true
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isSaving) {
            setSaveProgress(0);
            interval = setInterval(() => {
                setSaveProgress(prev => {
                    const increment = Math.max(0.2, (95 - prev) / 20); // Slower than compression
                    return Math.min(prev + increment, 95); // Stop at 95% until server finishes
                });
            }, 100);
        } else if (saveProgress > 0) {
            // Server finished
            setSaveProgress(100);
        }
        return () => clearInterval(interval);
    }, [isSaving]);

    const onUpload = async (files: File[]) => {
        const file = files[0];
        if (!file) return;

        setStagedFile({ name: file.name, size: file.size });
        setIsProcessing(true);
        setProcessProgress(0);

        const interval = setInterval(() => {
            setProcessProgress(prev => {
                const increment = Math.max(0.5, (99 - prev) / 10);
                return Math.min(prev + increment, 99);
            });
        }, 100);

        try {
            // Compress the image locally
            console.log("Processing image...");
            const compressedBase64 = await compressImage(file, 1024, 1024, 0.7);

            clearInterval(interval);
            setProcessProgress(100);

            // The dialog will auto-close via its own logic in 800ms
            setTimeout(() => {
                setSelected(compressedBase64);
                setStagedBase64(compressedBase64);
                setIsProcessing(false);
                setProcessProgress(0); // Reset for clean closure
            }, 850);

        } catch (error) {
            clearInterval(interval);
            console.error("Error processing file:", error);
            setProcessProgress(0);
            alert("Processing failed. The image might be too large.");
            setIsProcessing(false);
        }
    };

    const handleUploaderBack = () => {
        setStagedBase64(null);
        setStagedFile(null);
        setUploaderFiles([]);
        setSelected(currentAvatar || presetAvatars[0] || "");
        setShowUploader(false);
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* 1. Processing Dialog (Managed by FileUploader internally) */}
            {/* 2. Save Dialog (Managed explicitly here) */}
            <UploadProgress
                isOpen={!!isSaving && saveProgress > 0}
                totalProgress={Math.floor(saveProgress)}
                files={stagedBase64 ? (stagedFile ? [stagedFile] : [{ name: "Custom Avatar", size: 0 }]) : [{ name: "Updating profile...", size: 0 }]}
                onDone={() => {
                    // Handled by parent closing the modal
                }}
            />

            {/* Header */}
            <header className="flex items-center justify-between p-4 px-6 mt-10">
                <button onClick={onClose} className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors">
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-brand font-bold">Select avatar</h1>
                <div className="w-10" /> {/* Spacer to keep title centered */}
            </header>

            {/* Preview Section */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-6 px-6 py-4 overflow-hidden">
                <div className="shrink-0 relative">
                    {/* Outer Glow */}
                    <div className="absolute -inset-2 bg-[#3b82f6]/30 rounded-full blur-md animate-pulse" />
                    <div className="absolute inset-0 border-2 border-[#3b82f6] rounded-full" />

                    <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-xl bg-white relative">
                        {(isProcessing || isSaving) && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 rounded-full backdrop-blur-sm">
                                <Loader2 className="h-10 w-10 text-white animate-spin" />
                            </div>
                        )}
                        <AvatarImage src={selected} className="object-cover" />
                    </Avatar>
                </div>

                {/* Avatar Grid Container */}
                <div className="w-full max-w-sm flex-1 min-h-0 p-6 rounded-[2rem] border border-[#3b82f6]/20 bg-card/30 backdrop-blur-sm relative overflow-hidden flex flex-col">
                    {showUploader ? (
                        <div className="flex-1 flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleUploaderBack}
                                    className="p-1 hover:bg-muted rounded-full transition-colors"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                                <span className="text-sm font-medium">Upload custom avatar</span>
                            </div>
                            <FileUploader
                                value={uploaderFiles}
                                onValueChange={setUploaderFiles}
                                maxSize={5 * 1024 * 1024}
                                maxFiles={1}
                                onUpload={onUpload}
                                progresses={isProcessing ? { [stagedFile?.name || "file"]: processProgress } : {}}
                                disabled={isProcessing || isSaving}
                                showRemoveButton={false}
                                className="h-40"
                            />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-blue-500/20 scrollbar-track-transparent animate-in slide-in-from-left-4 duration-300">
                            <div className="grid grid-cols-3 gap-6 relative z-10 pb-2">
                                {/* Upload Trigger Button */}
                                <button
                                    onClick={() => setShowUploader(true)}
                                    className="aspect-square rounded-full bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors border border-blue-500/10"
                                    aria-label="Toggle custom upload"
                                >
                                    <Plus className="h-8 w-8 text-[#3b82f6]" />
                                </button>

                                {/* Preset Avatars */}
                                {presetAvatars.map((avatar, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            setSelected(avatar);
                                            setStagedBase64(null);
                                        }}
                                        className={cn(
                                            "aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-110 active:scale-95",
                                            selected === avatar && !stagedBase64 ? "border-[#3b82f6] ring-4 ring-[#3b82f6]/20 scale-105" : "border-transparent"
                                        )}
                                    >
                                        <img src={avatar} alt={`Avatar ${index}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer / Action */}
            <div className="p-8 pb-12 shrink-0 flex justify-center">
                <Button
                    onClick={() => onSelect(selected, !!stagedBase64)}
                    disabled={isProcessing || isSaving}
                    className="w-full max-w-xs h-14 rounded-2xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-lg font-bold shadow-lg shadow-[#3b82f6]/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
                >
                    {isProcessing ? "Processing..." : isSaving ? "Saving..." : "Save"}
                </Button>
            </div>
        </div>,
        document.body
    );
}
