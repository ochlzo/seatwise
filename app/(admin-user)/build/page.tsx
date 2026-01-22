"use strict";
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Toolbar as ModeToolbar, SelectionPanel } from "@/components/seatmap/UIOverlays";
import SeatmapToolbar from "@/components/seatmap/toolbar";
import { SeatMapSidebar } from "@/components/seatmap/seatmap-sidebar";
import { SeatmapPageHeader } from "@/components/seatmap/seatmap-page-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Dynamically import Konva component to avoid SSR issues
const SeatmapCanvas = dynamic(
    () => import("@/components/seatmap/SeatmapCanvas"),
    {
        ssr: false,
        loading: () => <div className="w-full h-full flex items-center justify-center text-zinc-400">Loading Canvas...</div>
    }
);

export default function TestPage() {
    return (
        <SidebarProvider className="h-svh overflow-hidden">
            <SeatMapSidebar />
            <SidebarInset className="overflow-hidden">
                <SeatmapPageHeader
                    title="Seatwise Prototype"
                    parentLabel="Seatmap"
                    parentHref="#"
                    rightSlot={<span className="text-xs text-zinc-500">app/test/page.tsx</span>}
                />
                <div className="flex-1 relative bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                    <ModeToolbar />
                    <SeatmapToolbar />
                    <SelectionPanel />
                    <SeatmapCanvas />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
