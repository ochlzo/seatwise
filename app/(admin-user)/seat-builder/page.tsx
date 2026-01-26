"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Toolbar as ModeToolbar, SelectionPanel } from "@/components/seatmap/UIOverlays";
import SeatmapToolbar from "@/components/seatmap/toolbar";
import { SeatMapSidebar } from "@/components/seatmap/seatmap-sidebar";
import { SeatmapPageHeader } from "@/components/seatmap/seatmap-page-header";
import { SeatmapTitle } from "@/components/seatmap/SeatmapTitle";
import { SeatmapExportActions } from "@/components/seatmap/SeatmapExportActions";
import { SeatmapSaveTemplateButton } from "@/components/seatmap/SeatmapSaveTemplateButton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import LoadingPage from "@/app/LoadingPage";
import { useAppDispatch } from "@/lib/hooks";
import { loadSeatmap, setTitle } from "@/lib/features/seatmap/seatmapSlice";
import { toast } from "sonner";

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
    const searchParams = useSearchParams();
    const seatmapId = searchParams.get("seatmapId");
    const dispatch = useAppDispatch();
    const [isLoadingSeatmap, setIsLoadingSeatmap] = React.useState(false);

    React.useEffect(() => {
        setTheme("light");
    }, [setTheme]);

    React.useEffect(() => {
        if (!seatmapId) return;
        let isMounted = true;
        const load = async () => {
            try {
                setIsLoadingSeatmap(true);
                const response = await fetch(`/api/seatmaps/${seatmapId}`);
                if (!response.ok) {
                    throw new Error("Failed to load seatmap");
                }
                const data = await response.json();
                if (!isMounted) return;
                dispatch(loadSeatmap(data.seatmap_json));
                dispatch(setTitle(data.seatmap_name));
            } catch (error: any) {
                if (!isMounted) return;
                toast.error(error.message || "Unable to load seatmap");
            } finally {
                if (isMounted) {
                    setIsLoadingSeatmap(false);
                }
            }
        };
        load();
        return () => {
            isMounted = false;
        };
    }, [seatmapId, dispatch]);

    return (
        <SidebarProvider className="h-svh overflow-hidden">
            <LoadingPage />
            <SeatMapSidebar />
            <SidebarInset className="overflow-hidden">
                <SeatmapPageHeader
                    title="Seatmap Designer"
                    parentLabel="Admin Dashboard"
                    parentHref="/admin"
                    rightSlot={
                        <div className="flex items-center">
                            <SeatmapTitle />
                            <SeatmapExportActions />
                            <SeatmapSaveTemplateButton />
                        </div>
                    }
                />
                <div className="flex-1 relative bg-zinc-100 overflow-hidden">
                    <ModeToolbar />
                    <SeatmapToolbar />
                    <SelectionPanel />
                    {isLoadingSeatmap && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3 text-zinc-600">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                                <span className="text-sm font-medium">Loading seatmap...</span>
                            </div>
                        </div>
                    )}
                    <SeatmapCanvas />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
