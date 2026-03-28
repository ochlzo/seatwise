"use client";

import { Copy, RotateCcw, RotateCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  deleteSelectedNode,
  duplicateSelectedNode,
  redo,
  undo,
} from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

export function TicketTemplateControlBar() {
  const dispatch = useAppDispatch();
  const selectedNodeId = useAppSelector((state) => state.ticketTemplate.selectedNodeId);
  const hasUndo = useAppSelector((state) => state.ticketTemplate.history.past.length > 0);
  const hasRedo = useAppSelector((state) => state.ticketTemplate.history.future.length > 0);
  const hasSelection = Boolean(selectedNodeId);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4">
      <div className="pointer-events-auto inline-flex items-center gap-1 rounded-xl border border-zinc-200/90 bg-white/95 p-1.5 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          onClick={() => dispatch(undo())}
          disabled={!hasUndo}
        >
          <RotateCcw className="h-4 w-4 text-violet-600" />
          Undo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          onClick={() => dispatch(redo())}
          disabled={!hasRedo}
        >
          <RotateCw className="h-4 w-4 text-violet-600" />
          Redo
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          onClick={() => dispatch(duplicateSelectedNode())}
          disabled={!hasSelection}
        >
          <Copy className="h-4 w-4 text-amber-600" />
          Duplicate
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-rose-600 hover:text-rose-600"
          onClick={() => dispatch(deleteSelectedNode())}
          disabled={!hasSelection}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}
