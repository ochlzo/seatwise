"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SeatmapPreviewCategory = {
    category_id: string;
    name: string;
    color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
};

const COLOR_CODE_TO_HEX: Record<SeatmapPreviewCategory["color_code"], string> = {
    NO_COLOR: "transparent",
    GOLD: "#ffd700",
    PINK: "#e005b9",
    BLUE: "#111184",
    BURGUNDY: "#800020",
    GREEN: "#046307",
};

type CategoryAssignPanelProps = {
    selectedSeatIds: string[];
    categories: SeatmapPreviewCategory[];
    /** Maps seat ID -> category ID (not color_code) */
    seatCategories: Record<string, string>;
    onAssign: (seatIds: string[], categoryId: string) => void;
    onClear: (seatIds: string[]) => void;
    className?: string;
};

export function CategoryAssignPanel({
    selectedSeatIds,
    categories,
    seatCategories,
    onAssign,
    onClear,
    className,
}: CategoryAssignPanelProps) {
    if (selectedSeatIds.length === 0) return null;

    // Get the set of category IDs assigned to selected seats
    const selectedCategoryIds = new Set(
        selectedSeatIds
            .map((id) => seatCategories[id])
            .filter((catId): catId is string => Boolean(catId))
    );
    const hasSelection = selectedCategoryIds.size > 0;

    return (
        <div
            className={cn(
                "w-52 rounded-lg border border-zinc-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur",
                className
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-zinc-700">Assign Category</span>
                <span className="text-[10px] text-zinc-400">
                    {selectedSeatIds.length} seat{selectedSeatIds.length === 1 ? "" : "s"}
                </span>
            </div>
            {categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center text-zinc-500">
                    <span className="text-[11px]">Add categories first</span>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {categories.map((category) => {
                        const isAssigned = selectedCategoryIds.has(category.category_id);
                        return (
                            <button
                                key={category.category_id}
                                type="button"
                                className={cn(
                                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50",
                                    isAssigned
                                        ? "border-primary ring-1 ring-primary/40"
                                        : "border-zinc-200",
                                    !hasSelection && "border-zinc-200"
                                )}
                                onClick={() => onAssign(selectedSeatIds, category.category_id)}
                            >
                                <span
                                    className={cn(
                                        "h-2.5 w-2.5 rounded-full border border-zinc-300",
                                        category.color_code === "NO_COLOR" && "bg-transparent"
                                    )}
                                    style={{
                                        backgroundColor:
                                            category.color_code === "NO_COLOR"
                                                ? "transparent"
                                                : COLOR_CODE_TO_HEX[category.color_code],
                                        backgroundImage:
                                            category.color_code === "NO_COLOR"
                                                ? "linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 50%, #e2e8f0 50%, #e2e8f0 75%, transparent 75%, transparent)"
                                                : undefined,
                                        backgroundSize:
                                            category.color_code === "NO_COLOR" ? "6px 6px" : undefined,
                                    }}
                                />
                                <span className="truncate">{category.name || "Untitled"}</span>
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                        onClick={() => onClear(selectedSeatIds)}
                    >
                        <span className="h-2.5 w-2.5 rounded-full border border-zinc-300 bg-transparent" />
                        <span>Clear</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export { COLOR_CODE_TO_HEX };
