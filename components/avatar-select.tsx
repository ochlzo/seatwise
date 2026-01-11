"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";



interface AvatarSelectProps {
    onClose: () => void;
    onSelect: (avatarUrl: string) => void;
    currentAvatar?: string;
    presetAvatars: string[];
}

export function AvatarSelect({ onClose, onSelect, currentAvatar, presetAvatars }: AvatarSelectProps) {
    const [selected, setSelected] = useState(currentAvatar || presetAvatars[0] || "");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Prevent scrolling on the body when the overlay is open
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "unset";
        };
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
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

                    <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-xl bg-white">
                        <AvatarImage src={selected} className="object-cover" />
                    </Avatar>
                </div>

                {/* Avatar Grid Container */}
                <div className="w-full max-w-sm flex-1 min-h-0 p-6 rounded-[2rem] border border-[#3b82f6]/20 bg-card/30 backdrop-blur-sm relative overflow-hidden flex flex-col">
                    {/* Scrollable Grid Area */}
                    <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-blue-500/20 scrollbar-track-transparent">
                        <div className="grid grid-cols-3 gap-6 relative z-10 pb-2">
                            {/* Upload Button */}
                            <button
                                className="aspect-square rounded-full bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors border border-blue-500/10"
                                aria-label="Upload custom avatar"
                            >
                                <Plus className="h-8 w-8 text-[#3b82f6]" />
                            </button>

                            {/* Preset Avatars */}
                            {presetAvatars.map((avatar, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelected(avatar)}
                                    className={cn(
                                        "aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-110 active:scale-95",
                                        selected === avatar ? "border-[#3b82f6] ring-4 ring-[#3b82f6]/20 scale-105" : "border-transparent"
                                    )}
                                >
                                    <img src={avatar} alt={`Avatar ${index}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer / Action */}
            <div className="p-8 pb-12 shrink-0 flex justify-center">
                <Button
                    onClick={() => onSelect(selected)}
                    className="w-full max-w-xs h-14 rounded-2xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-lg font-bold shadow-lg shadow-[#3b82f6]/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    Save
                </Button>
            </div>
        </div>,
        document.body
    );
}
