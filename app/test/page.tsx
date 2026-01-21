"use strict";
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Sidebar, Toolbar, SelectionPanel } from "@/components/seatmap/UIOverlays";

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
        <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden text-zinc-900 dark:text-zinc-100">

            {/* Sidebar (Left) */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-hidden flex flex-col">

                {/* Header */}
                <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 bg-white dark:bg-zinc-900 z-10 shrink-0">
                    <h1 className="font-bold text-lg">Seatwise Prototype</h1>
                    <div className="ml-auto text-sm text-zinc-500">
                        app/test/page.tsx
                    </div>
                </header>

                {/* Canvas Area */}
                <div className="flex-1 relative bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                    <Toolbar />
                    <SelectionPanel />
                    <SeatmapCanvas />
                </div>
            </main>
        </div>
    );
}
