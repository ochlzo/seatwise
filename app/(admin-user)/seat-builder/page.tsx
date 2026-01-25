"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Toolbar as ModeToolbar, SelectionPanel } from "@/components/seatmap/UIOverlays";
import SeatmapToolbar from "@/components/seatmap/toolbar";
import { SeatMapSidebar } from "@/components/seatmap/seatmap-sidebar";
import { SeatmapPageHeader } from "@/components/seatmap/seatmap-page-header";
import { SeatmapTitle } from "@/components/seatmap/SeatmapTitle";
import { SeatmapExportActions } from "@/components/seatmap/SeatmapExportActions";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";

// Dynamically import Konva component to avoid SSR issues
const SeatmapCanvas = dynamic(
    () => import("@/components/seatmap/SeatmapCanvas"),
    {
        ssr: false,
        loading: () => <div className="w-full h-full flex items-center justify-center text-zinc-400">Loading Canvas...</div>
    }
);

export default function Page() {
    const { setTheme } = useTheme();

    React.useEffect(() => {
        setTheme("light");
    }, [setTheme]);

    return (
        <SidebarProvider className="h-svh overflow-hidden">
            <SeatMapSidebar />
            <SidebarInset className="overflow-hidden">
                <SeatmapPageHeader
                    title="Seatmap Designer"
                    parentLabel="Dashboard"
                    parentHref="/dashboard"
                    rightSlot={
                        <div className="flex items-center">
                            <SeatmapTitle />
                            <SeatmapExportActions />
                        </div>
                    }
                />
                <div className="flex-1 relative bg-zinc-100 overflow-hidden">
                    <ModeToolbar />
                    <SeatmapToolbar />
                    <SelectionPanel />
                    <SeatmapCanvas />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
