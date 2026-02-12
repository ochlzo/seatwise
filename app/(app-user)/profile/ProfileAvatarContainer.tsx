"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SquarePen } from "lucide-react";
import { AvatarSelect } from "@/components/avatar-select";
import { updateAvatarAction } from "@/lib/actions/updateAvatar";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setUser } from "@/lib/features/auth/authSlice";

interface ProfileAvatarContainerProps {
    initialAvatarUrl: string;
    fallback: string;
    defaultAvatars: string[];
}

export function ProfileAvatarContainer({ initialAvatarUrl, fallback, defaultAvatars }: ProfileAvatarContainerProps) {
    const dispatch = useAppDispatch();
    const user = useAppSelector((state) => state.auth.user);
    const [showSelect, setShowSelect] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

    const handleSelect = async (newAvatarUrl: string, isCustom: boolean) => {
        try {
            const result = await updateAvatarAction(newAvatarUrl, isCustom);

            if (result.success && result.url) {
                setAvatarUrl(result.url);
                setShowSelect(false);

                // Update global Redux state
                if (user) {
                    dispatch(setUser({
                        ...user,
                        photoURL: result.url
                    }));
                }
            } else {
                alert(result.error || "Failed to save avatar");
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("An unexpected error occurred while saving your avatar.");
        }
    };

    return (
        <>
            <div className="relative group shrink-0">
                <Avatar className="h-28 w-28 md:h-32 md:w-32 border-4 border-background shadow-lg transition-transform duration-300 group-hover:scale-[1.02] shrink-0">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-xl md:text-2xl font-bold bg-[#3b82f6] text-white">
                        {fallback}
                    </AvatarFallback>
                </Avatar>
                <button
                    onClick={() => setShowSelect(true)}
                    className="absolute bottom-1 right-1 p-3 md:p-2.5 rounded-full bg-[#3b82f6] text-white shadow-xl border-2 border-background 
                     hover:bg-[#2563eb] transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                    aria-label="Edit Profile Picture"
                >
                    <SquarePen className="h-4 w-4" />
                </button>
            </div>

            {showSelect && (
                <AvatarSelect
                    currentAvatar={avatarUrl}
                    onClose={() => setShowSelect(false)}
                    onSelect={handleSelect}
                    presetAvatars={defaultAvatars}
                />
            )}
        </>
    );
}
