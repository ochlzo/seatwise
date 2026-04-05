"use client";

import * as React from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  addSeatGrid,
  setDrawShape,
  setMode,
  setShowGuidePaths,
  setSnapSpacing,
} from "@/lib/features/seatmap/seatmapSlice";
import { DialogTrigger } from "@/components/ui/dialog";
import { SeatmapHowToDialog } from "@/components/seatmap/how-to";
import Image from "next/image";
import type { SeatmapShapeNode } from "@/lib/seatmap/types";

export function SeatMapSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const dispatch = useAppDispatch();
  const drawShape = useAppSelector((state) => state.seatmap.drawShape);
  const showGuidePaths = useAppSelector(
    (state) => state.seatmap.showGuidePaths,
  );
  const snapSpacing = useAppSelector((state) => state.seatmap.snapSpacing);
  const viewport = useAppSelector((state) => state.seatmap.viewport);
  const viewportSize = useAppSelector((state) => state.seatmap.viewportSize);
  const [gridRows, setGridRows] = React.useState(3);
  const [gridCols, setGridCols] = React.useState(3);
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const setIconDragImage = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const icon = event.currentTarget.querySelector(
        "[data-drag-icon]",
      ) as HTMLElement | null;
      if (!icon) return;

      const dragPreview = icon.cloneNode(true) as HTMLElement;
      dragPreview.style.position = "fixed";
      dragPreview.style.top = "-9999px";
      dragPreview.style.left = "-9999px";
      dragPreview.style.pointerEvents = "none";
      dragPreview.style.margin = "0";
      dragPreview.style.transform = "none";

      document.body.appendChild(dragPreview);
      const rect = dragPreview.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        dragPreview,
        rect.width / 2,
        rect.height / 2,
      );

      requestAnimationFrame(() => {
        if (dragPreview.parentNode) {
          dragPreview.parentNode.removeChild(dragPreview);
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="px-2 py-2 flex items-center justify-center">
          <Image
            src="/logo_light.png"
            alt="Seatwise"
            width={120}
            height={32}
            className="h-8 w-auto object-contain dark:hidden"
            priority
          />
          <Image
            src="/logo_dark.png"
            alt="Seatwise"
            width={120}
            height={32}
            className="h-8 w-auto object-contain hidden dark:block"
            priority
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 pb-2">
        <div className="text-xs text-zinc-500 mb-2">Seats (draggable)</div>
        <div
          className="p-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          draggable
          onDragStart={(e) => {
            setIconDragImage(e);
            e.dataTransfer.setData("type", "seat");
            e.dataTransfer.setData("seatType", "standard");
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          <div
            data-drag-icon
            className="w-10 h-10 relative flex items-center justify-center"
          >
            <Image
              src="/seat-default.svg"
              alt="Seat"
              width={40}
              height={40}
              className="h-full w-full object-contain dark:hidden"
            />
            <Image
              src="/seat-default-darkmode.svg"
              alt="Seat"
              width={40}
              height={40}
              className="hidden h-full w-full object-contain dark:block"
            />
          </div>
          <span className="text-xs font-medium">Standard Seat</span>
        </div>

        <div className="text-xs text-zinc-500 mb-2 mt-4">Seat Grid</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            className="w-16 rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs dark:border-zinc-800"
            value={gridRows}
            onChange={(e) => setGridRows(Math.max(1, Number(e.target.value)))}
            aria-label="Rows"
          />
          <span className="text-xs text-zinc-400">x</span>
          <input
            type="number"
            min={1}
            className="w-16 rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs dark:border-zinc-800"
            value={gridCols}
            onChange={(e) => setGridCols(Math.max(1, Number(e.target.value)))}
            aria-label="Columns"
          />
          <button
            type="button"
            className="ml-auto rounded border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            onClick={() => {
              const center = {
                x:
                  (viewportSize.width / 2 - viewport.position.x) /
                  viewport.scale,
                y:
                  (viewportSize.height / 2 - viewport.position.y) /
                  viewport.scale,
              };
              dispatch(
                addSeatGrid({
                  rows: gridRows,
                  cols: gridCols,
                  center,
                  gap: snapSpacing,
                }),
              );
            }}
          >
            Create
          </button>
        </div>

        <div className="text-xs text-zinc-500 mb-2 mt-4">Spacing</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            className="w-full rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs dark:border-zinc-800"
            value={snapSpacing}
            onChange={(e) =>
              dispatch(setSnapSpacing(Math.max(0, Number(e.target.value))))
            }
            placeholder="Spacing (px)"
          />
        </div>

        <div className="text-xs text-zinc-500 mb-2 mt-4">Shapes</div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                label: "Square",
                shape: "rect",
                icon: <div className="w-8 h-8 border-2 border-zinc-500" />,
              },
              {
                label: "Circle",
                shape: "circle",
                icon: (
                  <div className="w-8 h-8 rounded-full border-2 border-zinc-500" />
                ),
              },
              {
                label: "Hexagon",
                shape: "polygon",
                sides: 6,
                icon: (
                  <svg
                    viewBox="0 0 100 100"
                    className="w-8 h-8"
                    aria-hidden="true"
                  >
                    <polygon
                      points="25,6 75,6 98,50 75,94 25,94 2,50"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                    />
                  </svg>
                ),
              },
              {
                label: "Line",
                shape: "line",
                icon: (
                  <div className="w-8 h-0 border-t-2 border-zinc-500 mt-4" />
                ),
              },
              {
                label: "Text",
                shape: "text",
                icon: (
                  <div className="w-8 h-8 border-2 border-zinc-500 flex items-center justify-center text-xs font-semibold text-zinc-600">
                    T
                  </div>
                ),
              },
            ] as Array<{
              label: string;
              shape: SeatmapShapeNode["shape"];
              icon: React.ReactNode;
              sides?: number;
            }>
          ).map((item, i) => (
            <div
              key={i}
              className={`p-2 border rounded flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                drawShape.shape === item.shape &&
                (drawShape.sides ?? 0) === (item.sides ?? 0)
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
              draggable
              onDragStart={(e) => {
                setIconDragImage(e);
                e.dataTransfer.setData("type", "shape");
                e.dataTransfer.setData("shape", item.shape);
                if (item.sides !== undefined) {
                  e.dataTransfer.setData("sides", String(item.sides));
                }
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => {
                if (item.shape === "line") {
                  dispatch(setMode("draw"));
                }
                dispatch(
                  setDrawShape({
                    shape: item.shape,
                    sides: item.sides,
                  }),
                );
              }}
            >
              <div
                data-drag-icon
                className="flex h-8 w-8 items-center justify-center"
              >
                {item.icon}
              </div>
              <span className="text-[10px]">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="text-xs text-zinc-500 mb-2 mt-4">Guide Path</div>
        <div
          className={`p-2 border rounded flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
            drawShape.shape === "guidePath"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
          draggable
          onDragStart={(e) => {
            setIconDragImage(e);
            e.dataTransfer.setData("type", "shape");
            e.dataTransfer.setData("shape", "guidePath");
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => {
            dispatch(setMode("draw"));
            dispatch(setDrawShape({ shape: "guidePath" }));
          }}
        >
          <div
            data-drag-icon
            className="w-8 h-2 border-b-2 border-dashed border-zinc-500"
          />
          <span className="text-[10px]">Guide Path</span>
        </div>

        <label className="mt-4 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600"
            checked={showGuidePaths}
            onChange={(e) => dispatch(setShowGuidePaths(e.target.checked))}
          />
          Show guide paths
        </label>
      </SidebarContent>
      <SidebarFooter className="px-3 py-3">
        <div className="text-xs text-zinc-500 space-y-1">
          <p>Controls:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Drag & drop to add items</li>
            <li>Click to select</li>
            <li>Drag selected to move</li>
            <li>Scroll to zoom</li>
          </ul>
          <SeatmapHowToDialog
            trigger={
              <DialogTrigger asChild>
                <a
                  className="inline-flex items-center text-xs text-blue-600 hover:underline dark:text-blue-400"
                  href="#"
                >
                  more
                </a>
              </DialogTrigger>
            }
          />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
