"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function SeatmapHowToDialog({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  return (
    <Dialog>
      {trigger}
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seatmap Controls</DialogTitle>
          <DialogDescription>
            Full reference for navigation, selection, editing, and shortcuts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 text-sm text-zinc-700 dark:text-zinc-200">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Navigation
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Trackpad two-finger scroll pans the canvas.</li>
              <li>Pinch zooms to cursor (min 0.4, max 3).</li>
              <li>Right-click drag pans the canvas.</li>
              <li>Reset View fits all nodes into the viewport.</li>
            </ul>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Selection
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Click to select a seat or shape.</li>
              <li>Shift/Ctrl/Cmd click toggles multi-select.</li>
              <li>Marquee drag in select mode to multi-select.</li>
              <li>Shift/Ctrl add to selection; Alt subtracts.</li>
            </ul>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Editing
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Drag selected items to move.</li>
              <li>Group resize uses the transformer handles.</li>
              <li>Rotation is via the rotate handle only.</li>
              <li>Hold Shift for 15° rotation snapping.</li>
            </ul>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Draw Mode
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Select a shape and click-drag to draw.</li>
              <li>Line endpoints are draggable after selection.</li>
              <li>Hold Shift to snap line/guide endpoints.</li>
            </ul>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Shortcuts
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Copy: Ctrl/Cmd + C</li>
              <li>Paste: Ctrl/Cmd + V</li>
              <li>Undo: Ctrl/Cmd + Z</li>
              <li>Redo: Ctrl/Cmd + Y</li>
              <li>Delete: Delete / Backspace</li>
              <li>Rotate: [ / ] (Shift for 15°)</li>
              <li>Scale: - / =</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
