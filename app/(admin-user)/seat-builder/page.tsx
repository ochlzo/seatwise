"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Toolbar as ModeToolbar, SelectionPanel } from "@/components/seatmap/UIOverlays";
import SeatmapToolbar from "@/components/seatmap/toolbar";
import { SeatMapSidebar } from "@/components/seatmap/seatmap-sidebar";
import { SeatmapPageHeader } from "@/components/seatmap/seatmap-page-header";
import { SeatmapTitle } from "@/components/seatmap/SeatmapTitle";
import { SeatmapFileMenu } from "@/components/seatmap/SeatmapFileMenu";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import LoadingPage from "@/app/LoadingPage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadSeatmap, setTitle, markSeatmapSaved } from "@/lib/features/seatmap/seatmapSlice";
import { toast } from "sonner";

// Dynamically import Konva component to avoid SSR issues
const SeatmapCanvas = dynamic(
    () => import("@/components/seatmap/SeatmapCanvas"),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full w-full items-center justify-center text-zinc-500 dark:text-zinc-400">
                Loading Canvas...
            </div>
        )
    }
);

export default function Page() {
    const searchParams = useSearchParams();
    const seatmapId = searchParams.get("seatmapId");
    const dispatch = useAppDispatch();
    const [isLoadingSeatmap, setIsLoadingSeatmap] = React.useState(false);
    const hasUnsavedChanges = useAppSelector((state) => state.seatmap.hasUnsavedChanges);
    const seatmapTitle = useAppSelector((state) => state.seatmap.title);

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
                // Debug helpers (disabled): console log + JSON download for DB payload.
                // console.log("Seatmap JSON from DB:", data.seatmap_json);
                // const jsonBlob = new Blob(
                //     [JSON.stringify(data.seatmap_json ?? {}, null, 2)],
                //     { type: "application/json" }
                // );
                // const downloadUrl = URL.createObjectURL(jsonBlob);
                // const link = document.createElement("a");
                // link.href = downloadUrl;
                // link.download = `${data.seatmap_name ?? "seatmap"}-db.json`;
                // document.body.appendChild(link);
                // link.click();
                // document.body.removeChild(link);
                // URL.revokeObjectURL(downloadUrl);
                if (!isMounted) return;
                dispatch(loadSeatmap(data.seatmap_json));
                dispatch(setTitle(data.seatmap_name));
                dispatch(markSeatmapSaved());
            } catch (error: unknown) {
                if (!isMounted) return;
                const message = error instanceof Error ? error.message : "Unable to load seatmap";
                toast.error(message);
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

    React.useEffect(() => {
        return () => {
            dispatch(markSeatmapSaved());
        };
    }, [dispatch]);

    React.useEffect(() => {
        if (!hasUnsavedChanges) return;
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsavedChanges]);

    React.useEffect(() => {
        if (!hasUnsavedChanges) return;

        const confirmLeave = () =>
            window.confirm("You have unsaved changes. Leave this page anyway?");

        const handleLinkClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            const anchor = target.closest("a") as HTMLAnchorElement | null;
            if (!anchor) return;
            if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#")) return;
            if (!confirmLeave()) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        const handlePopState = () => {
            if (!confirmLeave()) {
                window.history.pushState(null, "", window.location.href);
            }
        };

        document.addEventListener("click", handleLinkClick, true);
        window.addEventListener("popstate", handlePopState);
        return () => {
            document.removeEventListener("click", handleLinkClick, true);
            window.removeEventListener("popstate", handlePopState);
        };
    }, [hasUnsavedChanges]);

    return (
        <SidebarProvider className="h-svh overflow-hidden" suppressHydrationWarning>
            <LoadingPage />
            <SeatMapSidebar />
            <SidebarInset className="overflow-hidden">
                <SeatmapPageHeader
                    title="Seatmap Designer"
                    parentLabel="Admin Dashboard"
                    parentHref="/admin"
                    breadcrumbs={
                        seatmapId
                            ? [
                                { label: "Home", href: "/" },
                                { label: "Admin Dashboard", href: "/admin" },
                                { label: "Seatmap Templates", href: "/admin/templates" },
                                { label: seatmapTitle || "Seatmap" },
                            ]
                            : undefined
                    }
                    rightSlot={
                        <div className="flex items-center gap-2">
                            <ThemeSwithcer />
                            <SeatmapTitle />
                            <SeatmapFileMenu />
                        </div>
                    }
                />
                <div className="relative flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                    <ModeToolbar />
                    <SeatmapToolbar />
                    <SelectionPanel />
                    {isLoadingSeatmap && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-zinc-950/70">
                            <div className="flex flex-col items-center gap-3 text-zinc-700 dark:text-zinc-200">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-200" />
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
