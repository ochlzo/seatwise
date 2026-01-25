"use client";

import React from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  ClipboardPaste,
  Redo2,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  copySelected,
  pasteNodesAt,
  undo,
  redo,
  deleteSelected,
  updateNodesPositions,
  setSelectedIds,
  setShowGrid,
} from "@/lib/features/seatmap/seatmapSlice";

const NUDGE_STEP = 10;

export default function SeatmapToolbar() {
  const dispatch = useAppDispatch();
  const selectedIds = useAppSelector((state) => state.seatmap.selectedIds);
  const nodes = useAppSelector((state) => state.seatmap.nodes);
  const viewport = useAppSelector((state) => state.seatmap.viewport);
  const viewportSize = useAppSelector((state) => state.seatmap.viewportSize);
  const showGrid = useAppSelector((state) => state.seatmap.showGrid);

  const hasSelection = selectedIds.length > 0;

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selectedIds.length) return;
    const positions: Record<string, { x: number; y: number }> = {};
    selectedIds.forEach((id) => {
      const node = nodes[id];
      if (!node) return;
      if (!("position" in node)) return;
      positions[id] = {
        x: node.position.x + dx,
        y: node.position.y + dy,
      };
    });
    if (Object.keys(positions).length) {
      dispatch(updateNodesPositions({ positions, history: true }));
    }
  };

  const handlePaste = () => {
    const center = {
      x: viewportSize.width / 2,
      y: viewportSize.height / 2,
    };
    const pos = {
      x: (center.x - viewport.position.x) / viewport.scale,
      y: (center.y - viewport.position.y) / viewport.scale,
    };
    dispatch(pasteNodesAt(pos));
  };

  const handleClearAll = () => {
    const allIds = Object.keys(nodes);
    if (!allIds.length) return;
    dispatch(setSelectedIds(allIds));
    dispatch(deleteSelected());
  };

  const isMobile = useIsMobile();

  return (
    <div className={cn(
      "absolute bottom-4 left-1/2 z-20 -translate-x-1/2 max-w-[95vw]",
      isMobile ? "bottom-2" : "bottom-4"
    )}>
      <div className={cn(
        "flex items-center gap-1 rounded-full border border-zinc-200 bg-white/95 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 overflow-x-auto no-scrollbar max-w-full",
        isMobile ? "px-2 py-1.5" : "px-3 py-2"
      )}>
        <Button
          variant="ghost"
          size={isMobile ? "icon" : "sm"}
          onClick={() => dispatch(copySelected())}
          disabled={!hasSelection}
          title="Copy"
        >
          <Copy className={cn("h-4 w-4", !isMobile && "mr-2")} />
          {!isMobile && "Copy"}
        </Button>
        <Button
          variant="ghost"
          size={isMobile ? "icon" : "sm"}
          onClick={handlePaste}
          title="Paste"
        >
          <ClipboardPaste className={cn("h-4 w-4", !isMobile && "mr-2")} />
          {!isMobile && "Paste"}
        </Button>
        <Button
          variant="ghost"
          size={isMobile ? "icon" : "sm"}
          onClick={() => dispatch(undo())}
          title="Undo"
        >
          <Undo2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
          {!isMobile && "Undo"}
        </Button>
        <Button
          variant="ghost"
          size={isMobile ? "icon" : "sm"}
          onClick={() => dispatch(redo())}
          title="Redo"
        >
          <Redo2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
          {!isMobile && "Redo"}
        </Button>
        <Button
          variant="ghost"
          size={isMobile ? "icon" : "sm"}
          onClick={() => dispatch(deleteSelected())}
          disabled={!hasSelection}
          title="Delete"
        >
          <Trash2 className={cn("h-4 w-4 text-red-500", !isMobile && "mr-2")} />
          {!isMobile && "Delete"}
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => nudgeSelected(0, -NUDGE_STEP)}
            disabled={!hasSelection}
            aria-label="Move up"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => nudgeSelected(-NUDGE_STEP, 0)}
            disabled={!hasSelection}
            aria-label="Move left"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => nudgeSelected(NUDGE_STEP, 0)}
            disabled={!hasSelection}
            aria-label="Move right"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => nudgeSelected(0, NUDGE_STEP)}
            disabled={!hasSelection}
            aria-label="Move down"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          variant={showGrid ? "default" : "ghost"}
          size={isMobile ? "icon" : "sm"}
          onClick={() => dispatch(setShowGrid(!showGrid))}
          title="Grid"
        >
          {!isMobile && "Grid"}
          {isMobile && <div className="h-4 w-4 border-2 border-current rounded-sm opacity-60" />}
        </Button>

        {!isMobile && (
          <>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button variant="ghost" size="sm" onClick={handleClearAll}>
              <XCircle className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
