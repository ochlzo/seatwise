"use strict";
"use client";

import React from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setMode, setViewport } from "@/lib/features/seatmap/seatmapSlice";
import { LocateFixed, Move, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
    return (
        <div className="w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full z-10 shrink-0">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="font-bold text-lg">Seat Palette</h2>
            </div>
            <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
                <div className="text-sm text-zinc-500 mb-2">Seats</div>
                <div
                    className="p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData("type", "seat");
                        e.dataTransfer.effectAllowed = "copy";
                    }}
                >
                    <div className="w-12 h-12 relative flex items-center justify-center">
                        <img src="/armchair.svg" alt="Seat" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-sm font-medium">Standard Seat</span>
                </div>

                <div className="text-sm text-zinc-500 mb-2 mt-4">Shapes</div>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: "Square", type: "shape", shape: "rect", icon: <div className="w-8 h-8 border-2 border-zinc-500" /> },
                        { label: "Circle", type: "shape", shape: "circle", icon: <div className="w-8 h-8 rounded-full border-2 border-zinc-500" /> },
                        { label: "Hexagon", type: "shape", shape: "polygon", sides: 6, icon: <div className="w-8 h-8 border-2 border-zinc-500 transform rotate-45" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", background: 'none' }} /> },
                        { label: "Stairs", type: "shape", shape: "stairs", icon: <div className="w-8 h-8 flex flex-col justify-between border-2 border-zinc-500 p-0.5"><div className="h-px bg-zinc-500" /><div className="h-px bg-zinc-500" /><div className="h-px bg-zinc-500" /></div> },
                        { label: "Line", type: "shape", shape: "line", icon: <div className="w-8 h-0 border-t-2 border-zinc-500 mt-4" /> },
                        { label: "Dashed", type: "shape", shape: "line", dash: [5, 5], icon: <div className="w-8 h-0 border-t-2 border-dashed border-zinc-500 mt-4" /> },
                    ].map((item, i) => (
                        <div
                            key={i}
                            className="p-3 border border-zinc-200 dark:border-zinc-800 rounded flex flex-col items-center gap-2 cursor-grab hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData("type", item.type);
                                e.dataTransfer.setData("shape", item.shape);
                                if (item.sides) e.dataTransfer.setData("sides", item.sides.toString());
                                if (item.dash) e.dataTransfer.setData("dash", JSON.stringify(item.dash));
                                e.dataTransfer.effectAllowed = "copy";
                            }}
                        >
                            {item.icon}
                            <span className="text-xs">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                <div className="text-xs text-zinc-500">
                    <p>Controls:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Drag & Drop to add items</li>
                        <li>Click to select</li>
                        <li>Drag selected to move</li>
                        <li>Scroll to zoom</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export function Toolbar() {
    const dispatch = useAppDispatch();
    const mode = useAppSelector(state => state.seatmap.mode);

    return (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 bg-white dark:bg-zinc-900 p-2 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
            <Button
                variant={mode === "select" ? "default" : "ghost"}
                size="icon"
                onClick={() => dispatch(setMode("select"))}
                title="Select Mode"
            >
                <MousePointer2 className="w-4 h-4" />
            </Button>
            <Button
                variant={mode === "pan" ? "default" : "ghost"}
                size="icon"
                onClick={() => dispatch(setMode("pan"))}
                title="Pan Mode"
            >
                <Move className="w-4 h-4" />
            </Button>
            <div className="w-full h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
            <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch(setViewport({ position: { x: 0, y: 0 }, scale: 1 }))}
                title="Reset View"
            >
                <LocateFixed className="w-4 h-4" />
            </Button>
        </div>
    )
}

export function SelectionPanel() {
    const dispatch = useAppDispatch();
    const selectedIds = useAppSelector(state => state.seatmap.selectedIds);
    const nodes = useAppSelector(state => state.seatmap.nodes);

    if (selectedIds.length === 0) return null;

    const selectedNode = nodes[selectedIds[0]];
    if (!selectedNode) return null;

    return (
        <div className="absolute top-4 right-4 z-20 w-64 bg-white dark:bg-zinc-900 p-4 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold mb-2">Selection</h3>
            <div className="text-sm space-y-2">
                <div className="flex justify-between">
                    <span className="text-zinc-500">ID:</span>
                    <span className="font-mono text-xs">{selectedNode.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-500">Type:</span>
                    <span className="capitalize">{selectedNode.type}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-500">Rotation:</span>
                    <span>{Math.round(selectedNode.rotation || 0)}°</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-zinc-500">X / Y:</span>
                    <span>{Math.round(selectedNode.position.x)} / {Math.round(selectedNode.position.y)}</span>
                </div>
            </div>
        </div>
    )
}
