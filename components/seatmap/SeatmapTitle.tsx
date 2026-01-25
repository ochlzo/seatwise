"use client";

import React from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setTitle } from "@/lib/features/seatmap/seatmapSlice";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Edit2 } from "lucide-react";

export function SeatmapTitle({ className }: { className?: string }) {
    const dispatch = useAppDispatch();
    const title = useAppSelector((state) => state.seatmap.title);

    return (
        <div className={cn("flex items-center gap-2 group", className)}>
            <div className="relative flex items-center">
                <Input
                    value={title}
                    onChange={(e) => dispatch(setTitle(e.target.value))}
                    placeholder="Enter title..."
                    className="h-8 md:w-[280px] w-[140px] pr-8 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 focus-visible:ring-blue-500 font-semibold text-sm transition-all"
                />
                <Edit2 className="absolute right-2.5 w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-500 transition-colors pointer-events-none" />
            </div>
        </div>
    );
}
