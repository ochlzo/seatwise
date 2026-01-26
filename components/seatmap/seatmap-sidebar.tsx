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
  updateCategories,
} from "@/lib/features/seatmap/seatmapSlice";
import { DialogTrigger } from "@/components/ui/dialog";
import { SeatmapHowToDialog } from "@/components/seatmap/how-to";
import { Plus, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export function SeatMapSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const dispatch = useAppDispatch();
  const drawShape = useAppSelector((state) => state.seatmap.drawShape);
  const showGuidePaths = useAppSelector((state) => state.seatmap.showGuidePaths);
  const snapSpacing = useAppSelector((state) => state.seatmap.snapSpacing);
  const viewport = useAppSelector((state) => state.seatmap.viewport);
  const viewportSize = useAppSelector((state) => state.seatmap.viewportSize);
  const categories = useAppSelector((state) => state.seatmap.categories);
  const [gridRows, setGridRows] = React.useState(3);
  const [gridCols, setGridCols] = React.useState(3);
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="px-2 py-1">
          <h2 className="text-sm font-semibold">Seat Palette</h2>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 pb-2">
        <div className="text-xs text-zinc-500 mb-2">Seats (draggable)</div>
        <div
          className="p-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("type", "seat");
            e.dataTransfer.setData("seatType", "standard");
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          <div className="w-10 h-10 relative flex items-center justify-center">
            <img
              src="/seat-default.svg"
              alt="Seat"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xs font-medium">Standard Seat</span>
        </div>

        <div className="text-xs text-zinc-500 mb-2 mt-4">Seat Categories</div>
        <div className="flex flex-col gap-2">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="flex flex-col gap-1 p-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50/50 dark:bg-zinc-900/50"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 bg-transparent border-b text-xs py-1 outline-none"
                  style={{ borderBottomColor: cat.color }}
                  placeholder="Category Name"
                  value={cat.name}
                  onChange={(e) => {
                    const newCats = [...categories];
                    newCats[idx] = { ...cat, name: e.target.value };
                    dispatch(updateCategories(newCats));
                  }}
                />
                <button
                  onClick={() => {
                    const newCats = categories.filter((_, i) => i !== idx);
                    dispatch(updateCategories(newCats));
                  }}
                  className="p-1 hover:text-red-500 transition-colors"
                  title="Remove Category"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                {categories.length < 5 && idx === categories.length - 1 && (
                  <button
                    onClick={() => {
                      dispatch(updateCategories([
                        ...categories,
                        { id: uuidv4(), name: "", color: "#ffd700", price: "0" }
                      ]));
                    }}
                    className="p-1 hover:text-blue-500 transition-colors"
                    title="Add Category"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex gap-1 mt-1">
                  {["transparent", "#ffd700", "#e005b9", "#111184", "#800020", "#046307"].map((color) => (
                    <button
                      key={color}
                      className={`w-4 h-4 rounded-full border ${cat.color === color ? "border-zinc-900 dark:border-zinc-100 scale-110" : color === "transparent" ? "border-zinc-300 dark:border-zinc-700" : "border-transparent"}`}
                      style={{
                        backgroundColor: color,
                        backgroundImage: color === "transparent"
                          ? "linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 50%, #e2e8f0 50%, #e2e8f0 75%, transparent 75%, transparent)"
                          : undefined,
                        backgroundSize: color === "transparent" ? "6px 6px" : undefined,
                      }}
                      onClick={() => {
                        const newCats = [...categories];
                        newCats[idx] = { ...cat, color };
                        dispatch(updateCategories(newCats));
                      }}
                    />
                  ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-zinc-500">PHP</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-24 rounded border border-zinc-200 bg-transparent px-2 py-1 text-[10px] dark:border-zinc-800"
                  placeholder="0.00"
                  value={cat.price}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next !== "" && !/^\d{0,4}(\.\d{0,2})?$/.test(next)) {
                      return;
                    }
                    const newCats = [...categories];
                    newCats[idx] = { ...cat, price: next };
                    dispatch(updateCategories(newCats));
                  }}
                  onBlur={() => {
                    const raw = String(cat.price ?? "").trim();
                    const normalizedValue = raw === "" ? 0 : Number(raw);
                    if (Number.isNaN(normalizedValue)) {
                      const newCats = [...categories];
                      newCats[idx] = { ...cat, price: "0.00" };
                      dispatch(updateCategories(newCats));
                      return;
                    }
                    const clamped = Math.min(Math.max(normalizedValue, 0), 9999.99);
                    const newCats = [...categories];
                    newCats[idx] = { ...cat, price: clamped.toFixed(2) };
                    dispatch(updateCategories(newCats));
                  }}
                />
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <button
              onClick={() => {
                dispatch(updateCategories([
                  { id: uuidv4(), name: "", color: "#ffd700", price: "0" }
                ]));
              }}
              className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-600 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs">Add Category</span>
            </button>
          )}
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
                x: (viewportSize.width / 2 - viewport.position.x) / viewport.scale,
                y: (viewportSize.height / 2 - viewport.position.y) / viewport.scale,
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
            onChange={(e) => dispatch(setSnapSpacing(Math.max(0, Number(e.target.value))))}
            placeholder="Spacing (px)"
          />
        </div>

        <div className="text-xs text-zinc-500 mb-2 mt-4">Shapes (click and draw)</div>
        <div className="grid grid-cols-2 gap-2">
          {[
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
          ].map((item, i) => (
            <div
              key={i}
              className={`p-2 border rounded flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 ${drawShape.shape === item.shape &&
                (drawShape.sides ?? 0) === (item.sides ?? 0)
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-zinc-200 dark:border-zinc-800"
                }`}
              onClick={() => {
                dispatch(setMode("draw"));
                dispatch(
                  setDrawShape({
                    shape: item.shape as any,
                    sides: item.sides,
                  }),
                );
              }}
            >
              {item.icon}
              <span className="text-[10px]">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="text-xs text-zinc-500 mb-2 mt-4">Guide Path</div>
        <div
          className={`p-2 border rounded flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 ${drawShape.shape === "guidePath"
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
            : "border-zinc-200 dark:border-zinc-800"
            }`}
          onClick={() => {
            dispatch(setMode("draw"));
            dispatch(setDrawShape({ shape: "guidePath" }));
          }}
        >
          <div className="w-8 h-2 border-b-2 border-dashed border-zinc-500" />
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
      </SidebarContent >
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
    </Sidebar >
  );
}
