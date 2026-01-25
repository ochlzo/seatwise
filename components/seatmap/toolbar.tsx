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
  Grid3X3,
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
      "absolute z-20 transition-all duration-300",
      isMobile
        ? "right-2 top-2 flex flex-col items-center"
        : "bottom-4 left-1/2 -translate-x-1/2"
    )}>
      <div className={cn(
        "flex rounded-full border border-zinc-200 bg-white/95 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 no-scrollbar items-center",
        isMobile ? "flex-col py-3 px-1.5 gap-2" : "flex-row px-3 py-2 gap-1"
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

        <Separator
          orientation={isMobile ? "horizontal" : "vertical"}
          className={cn("mx-1", isMobile ? "h-px w-6 my-1" : "h-6 w-px")}
        />

        <div className={cn("flex items-center gap-1", isMobile ? "flex-col" : "flex-row")}>
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

        <Separator
          orientation={isMobile ? "horizontal" : "vertical"}
          className={cn("mx-1", isMobile ? "h-px w-6 my-1" : "h-6 w-px")}
        />

        <Button
          variant={showGrid ? "default" : "ghost"}
          size={isMobile ? "icon" : "sm"}
          onClick={() => dispatch(setShowGrid(!showGrid))}
          title="Toggle Grid"
        >
          <Grid3X3 className={cn("h-4 w-4", !isMobile && "mr-2")} />
          {!isMobile && "Grid"}
        </Button>

        <Separator
          orientation={isMobile ? "horizontal" : "vertical"}
          className={cn("mx-1", isMobile ? "h-px w-6 my-1" : "h-6 w-px")}
        />

        <Button
          variant="ghost"
          size={isMobile ? "icon" : "sm"}
          onClick={handleClearAll}
          title="Clear All"
        >
          <XCircle className={cn("h-4 w-4 text-orange-500/80", !isMobile && "mr-2")} />
          {!isMobile && "Clear All"}
        </Button>
      </div>
    </div>
  );
}
