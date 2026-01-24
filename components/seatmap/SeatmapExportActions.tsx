"use client";

import React from "react";
import { useAppSelector } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Save, Download } from "lucide-react";
import { toast } from "sonner";

export function SeatmapExportActions() {
    const seatmap = useAppSelector((state) => state.seatmap);

    const handleExport = () => {
        const exportData = {
            title: seatmap.title,
            nodes: seatmap.nodes,
            categories: seatmap.categories,
            viewport: seatmap.viewport,
            snapSpacing: seatmap.snapSpacing,
            exportedAt: new Date().toISOString(),
        };

        // Log to console for analysis as requested
        console.log("--- SEATMAP EXPORT JSON ---");
        console.log(JSON.stringify(exportData, null, 2));
        console.log("---------------------------");

        toast.success("Seatmap data exported to console!");
    };

    const handleDownload = () => {
        const exportData = {
            title: seatmap.title,
            nodes: seatmap.nodes,
            categories: seatmap.categories,
            viewport: seatmap.viewport,
            snapSpacing: seatmap.snapSpacing,
            exportedAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${seatmap.title.toLowerCase().replace(/\s+/g, "-")}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("Seatmap JSON downloaded!");
    };

    return (
        <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-4 ml-2">
            <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-8 gap-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
                <Save className="w-3.5 h-3.5" />
                <span>Save to Console</span>
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
