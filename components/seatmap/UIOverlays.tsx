"use client";

import React from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  setMode,
  setViewport,
  setDrawShape,
  updateNodes,
  toggleZoomLock,
  fitView,
} from "@/lib/features/seatmap/seatmapSlice";
import { LocateFixed, Move, MousePointer2, Pencil, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const dispatch = useAppDispatch();
  const drawShape = useAppSelector((state) => state.seatmap.drawShape);

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
            e.dataTransfer.setData("seatType", "standard");
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          <div className="w-12 h-12 relative flex items-center justify-center">
            <img
              src="/seat-default.svg"
              alt="Seat"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-sm font-medium">Standard Seat</span>
        </div>

        <div className="text-sm text-zinc-500 mb-2 mt-4">Shapes</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Square",
              type: "shape",
              shape: "rect",
              icon: <div className="w-8 h-8 border-2 border-zinc-500" />,
            },
            {
              label: "Circle",
              type: "shape",
              shape: "circle",
              icon: (
                <div className="w-8 h-8 rounded-full border-2 border-zinc-500" />
              ),
            },
            {
              label: "Hexagon",
              type: "shape",
              shape: "polygon",
              sides: 6,
              icon: (
                <div
                  className="w-8 h-8 border-2 border-zinc-500 transform rotate-45"
                  style={{
                    clipPath:
                      "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                    background: "none",
                  }}
                />
              ),
            },
            {
              label: "Line",
              type: "shape",
              shape: "line",
              icon: <div className="w-8 h-0 border-t-2 border-zinc-500 mt-4" />,
            },
            {
              label: "Text",
              type: "shape",
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
              className={`p-3 border rounded flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 ${drawShape.shape === item.shape &&
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
  const mode = useAppSelector((state) => state.seatmap.mode);
  const nodes = useAppSelector((state) => state.seatmap.nodes);
  const viewportSize = useAppSelector((state) => state.seatmap.viewportSize);
  const zoomLocked = useAppSelector((state) => state.seatmap.zoomLocked);

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
      <Button
        variant={mode === "draw" ? "default" : "ghost"}
        size="icon"
        onClick={() => dispatch(setMode("draw"))}
        title="Draw Mode"
      >
        <Pencil className="w-4 h-4" />
      </Button>
      <div className="w-full h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
      <Button
        variant={zoomLocked ? "default" : "ghost"}
        size="icon"
        onClick={() => dispatch(toggleZoomLock())}
        title={zoomLocked ? "Unlock Zoom" : "Lock Zoom"}
      >
        {zoomLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
      </Button>
      <div className="w-full h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => dispatch(fitView())}
        title="Reset View"
      >
        <LocateFixed className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function SelectionPanel() {
  const dispatch = useAppDispatch();
  const selectedIds = useAppSelector((state) => state.seatmap.selectedIds);
  const nodes = useAppSelector((state) => state.seatmap.nodes);
  const categories = useAppSelector((state) => state.seatmap.categories);

  const [rangeStart, setRangeStart] = React.useState("1");
  const [rangeError, setRangeError] = React.useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const selectedNode = nodes[selectedIds[0]];
  if (!selectedNode) return null;
  if (selectedNode.type === "helper") return null;

  const palette = [
    "#ffffff", "#cccccc", "#b2b2b2", "#e5e5e5", "#999999", "#7f7f7f",
    "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#6366f1", "#8b5cf6",
  ];

  const getCommonValue = (key: string, isNestedPosition?: "x" | "y") => {
    if (selectedIds.length === 0) return "";
    let value: any = undefined;
    for (let i = 0; i < selectedIds.length; i++) {
      const node = nodes[selectedIds[i]] as any;
      if (!node) continue;

      let current: any;
      if (isNestedPosition) {
        current = node.position?.[isNestedPosition];
      } else {
        current = node[key];
      }

      if (current === undefined) {
        if (key === 'rotation') current = 0;
        if (key === 'scaleX' || key === 'scaleY') current = 1;
      }

      if (i === 0) {
        value = current;
      } else if (value !== current) {
        return ""; // Mixed
      }
    }
    return value ?? "";
  };

  const isShapeSelection = selectedIds.every(id => nodes[id]?.type === 'shape');
  const isTextSelection = selectedIds.every(id => nodes[id]?.type === 'shape' && (nodes[id] as any).shape === 'text');
  const isSeatSelection = selectedIds.some(id => nodes[id]?.type === 'seat');

  const commonRotation = getCommonValue("rotation");
  const commonX = getCommonValue("position", "x");
  const commonY = getCommonValue("position", "y");
  const commonScaleX = getCommonValue("scaleX");
  const commonScaleY = getCommonValue("scaleY");
  const commonText = getCommonValue("text");
  const commonCategoryId = getCommonValue("categoryId");
  const commonRowLabel = getCommonValue("rowLabel");
  const commonSeatNumber = getCommonValue("seatNumber");

  const updateBulkRotation = (value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    const changes: Record<string, any> = {};
    selectedIds.forEach((id) => {
      if (nodes[id]) changes[id] = { rotation: next };
    });
    if (Object.keys(changes).length) dispatch(updateNodes({ changes }));
  };

  const updateBulkPosition = (axis: "x" | "y", value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    const changes: Record<string, any> = {};
    selectedIds.forEach((id) => {
      const node = nodes[id];
      if (!node || !("position" in node)) return;
      changes[id] = {
        position: {
          x: axis === "x" ? next : node.position.x,
          y: axis === "y" ? next : node.position.y,
        },
      };
    });
    if (Object.keys(changes).length) dispatch(updateNodes({ changes }));
  };

  const updateBulkScale = (axis: "x" | "y", value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    const changes: Record<string, any> = {};
    selectedIds.forEach((id) => {
      if (nodes[id]) {
        changes[id] = {
          scaleX: axis === "x" ? next : (nodes[id].scaleX ?? 1),
          scaleY: axis === "y" ? next : (nodes[id].scaleY ?? 1),
        };
      }
    });
    if (Object.keys(changes).length) dispatch(updateNodes({ changes }));
  };

  const updateBulkText = (text: string) => {
    const changes: Record<string, any> = {};
    selectedIds.forEach((id) => {
      if (nodes[id] && nodes[id].type === 'shape' && (nodes[id] as any).shape === 'text') {
        changes[id] = { text };
      }
    });
    if (Object.keys(changes).length) dispatch(updateNodes({ changes }));
  };

  const updateBulkSeatInfo = (changesToApply: { rowLabel?: string; seatNumber?: number }) => {
    const changes: Record<string, any> = {};
    selectedIds.forEach((id) => {
      const node = nodes[id];
      if (node && node.type === 'seat') {
        const nodeChanges: any = {};
        if ('rowLabel' in changesToApply) nodeChanges.rowLabel = changesToApply.rowLabel;
        if ('seatNumber' in changesToApply) nodeChanges.seatNumber = changesToApply.seatNumber;
        changes[id] = nodeChanges;
      }
    });
    if (Object.keys(changes).length) dispatch(updateNodes({ changes }));
  };

  const applySeatRange = () => {
    const startNum = parseInt(rangeStart, 10);
    if (isNaN(startNum)) {
      setRangeError("Invalid number");
      return;
    }
    setRangeError(null);
    const changes: Record<string, any> = {};
    const selectedSeats = selectedIds.filter(id => nodes[id]?.type === 'seat');
    selectedSeats.forEach((id, idx) => {
      changes[id] = { seatNumber: startNum + idx };
    });
    if (Object.keys(changes).length) dispatch(updateNodes({ changes }));
  };

  const updateBulkCategoryId = (categoryId: string | null) => {
    const changes: Record<string, any> = {};
    selectedIds.forEach((id) => {
      if (nodes[id]?.type === 'seat') {
        changes[id] = { categoryId: categoryId || undefined };
      }
    });
    if (Object.keys(changes).length) dispatch(updateNodes({ changes }));
  };

  const applyBulkColor = (type: "fill" | "stroke", color: string | null) => {
    const changes: Record<string, any> = {};
    selectedIds.forEach((id) => {
      const node = nodes[id];
      if (!node || node.type !== "shape") return;
      if (type === "fill" && node.shape === "line") return;
      changes[id] = { [type]: color ?? undefined };
    });
    if (Object.keys(changes).length) dispatch(updateNodes({ changes }));
  };

  return (
    <div className="absolute top-4 right-4 z-20 w-64 bg-white dark:bg-zinc-900 p-4 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">Selection</h3>
        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">
          {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="text-sm space-y-4">
        {/* Transforms */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Rotation:</span>
            <input
              type="number"
              className="w-16 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
              value={commonRotation !== "" ? Math.round(Number(commonRotation)) : ""}
              onChange={(e) => updateBulkRotation(e.target.value)}
            />
          </div>
          {selectedIds.length === 1 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500">X / Y:</span>
              <div className="flex gap-1">
                <input
                  type="number"
                  className="w-14 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
                  value={commonX !== "" ? Math.round(Number(commonX)) : ""}
                  onChange={(e) => updateBulkPosition("x", e.target.value)}
                />
                <input
                  type="number"
                  className="w-14 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
                  value={commonY !== "" ? Math.round(Number(commonY)) : ""}
                  onChange={(e) => updateBulkPosition("y", e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Scale X/Y:</span>
            <div className="flex gap-1">
              <input
                type="number"
                step="0.1"
                className="w-14 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
                value={commonScaleX ? Number(commonScaleX).toFixed(1) : ""}
                onChange={(e) => updateBulkScale("x", e.target.value)}
              />
              <input
                type="number"
                step="0.1"
                className="w-14 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
                value={commonScaleY ? Number(commonScaleY).toFixed(1) : ""}
                onChange={(e) => updateBulkScale("y", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Text Content */}
        {isTextSelection && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs text-zinc-500">Text Content:</span>
            <textarea
              className="w-full mt-1 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-xs min-h-[50px] resize-none"
              value={commonText}
              onChange={(e) => updateBulkText(e.target.value)}
            />
          </div>
        )}

        {/* Seat Labels */}
        {isSeatSelection && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="text-[11px] uppercase font-bold text-zinc-400">Seat Labeling</div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Row:</span>
              <input
                type="text"
                className="w-16 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right uppercase"
                placeholder="A, B..."
                value={commonRowLabel}
                onChange={(e) => updateBulkSeatInfo({ rowLabel: e.target.value.toUpperCase() })}
              />
            </div>
            {selectedIds.length === 1 ? (
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Number:</span>
                <input
                  type="text"
                  className="w-16 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
                  value={commonSeatNumber ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^\d+$/.test(val)) {
                      updateBulkSeatInfo({ seatNumber: val === "" ? undefined : parseInt(val, 10) });
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Start Num:</span>
                  <input
                    type="number"
                    className="w-16 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                  />
                </div>
                <Button size="sm" className="w-full h-8 text-[10px]" onClick={applySeatRange}>
                  Apply Range {rangeStart}...
                </Button>
                {rangeError && <p className="text-[10px] text-red-500 text-center">{rangeError}</p>}
              </div>
            )}
          </div>
        )}

        {/* Categories */}
        {isSeatSelection && categories.length > 0 && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] uppercase font-bold text-zinc-400 mb-2">Assign Category</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateBulkCategoryId(null)}
                className={`px-2 py-1 text-[10px] rounded border ${!commonCategoryId ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200"}`}
              >
                None
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => updateBulkCategoryId(cat.id)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded border ${commonCategoryId === cat.id ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-200"}`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="truncate max-w-[50px]">{cat.name || "Untitled"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Colors (Shapes Only) */}
        {isShapeSelection && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
            <div>
              <div className="text-[11px] text-zinc-500 mb-2">Stroke Color</div>
              <div className="grid grid-cols-6 gap-2">
                <button
                  type="button"
                  className="h-6 w-6 rounded border text-[10px] uppercase border-zinc-300 dark:border-zinc-700"
                  onClick={() => applyBulkColor("stroke", null)}
                >
                  T
                </button>
                {palette.map((color) => (
                  <button
                    key={`stroke-${color}`}
                    type="button"
                    className={`h-6 w-6 rounded border ${selectedIds.length === 1 && (nodes[selectedIds[0]] as any).stroke === color ? "border-zinc-900" : "border-zinc-200"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => applyBulkColor("stroke", color)}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500 mb-2">Fill Color</div>
              <div className="grid grid-cols-6 gap-2">
                <button
                  type="button"
                  className="h-6 w-6 rounded border text-[10px] uppercase border-zinc-300 dark:border-zinc-700"
                  onClick={() => applyBulkColor("fill", null)}
                >
                  T
                </button>
                {palette.map((color) => (
                  <button
                    key={`fill-${color}`}
                    type="button"
                    className={`h-6 w-6 rounded border ${selectedIds.length === 1 && (nodes[selectedIds[0]] as any).fill === color ? "border-zinc-900" : "border-zinc-200"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => applyBulkColor("fill", color)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
