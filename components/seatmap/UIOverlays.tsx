"use strict";
"use client";

import React from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  setMode,
  setViewport,
  setDrawShape,
  updateNode,
} from "@/lib/features/seatmap/seatmapSlice";
import { LocateFixed, Move, MousePointer2, Pencil } from "lucide-react";
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
        <div
          className="p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("type", "seat");
            e.dataTransfer.setData("seatType", "vip");
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          <div className="w-12 h-12 relative flex items-center justify-center">
            <img
              src="/default-vip-seat.svg"
              alt="VIP Seat"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-sm font-medium">VIP Seat</span>
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
              className={`p-3 border rounded flex flex-col items-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                drawShape.shape === item.shape &&
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
        variant="ghost"
        size="icon"
        onClick={() => {
          const items = Object.values(nodes);
          if (items.length === 0) {
            dispatch(setViewport({ position: { x: 0, y: 0 }, scale: 1 }));
            return;
          }

          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;

          const expand = (
            x: number,
            y: number,
            halfW: number,
            halfH: number,
          ) => {
            minX = Math.min(minX, x - halfW);
            maxX = Math.max(maxX, x + halfW);
            minY = Math.min(minY, y - halfH);
            maxY = Math.max(maxY, y + halfH);
          };

          items.forEach((node: any) => {
            const sx = node.scaleX ?? 1;
            const sy = node.scaleY ?? 1;

            if (node.type === "seat") {
              expand(node.position.x, node.position.y, 16 * sx, 16 * sy);
              return;
            }

            if (node.type !== "shape") return;

            if (node.shape === "rect" || node.shape === "stairs") {
              const w = (node.width ?? 0) * sx;
              const h = (node.height ?? 0) * sy;
              expand(node.position.x, node.position.y, w / 2, h / 2);
              return;
            }
            if (node.shape === "text") {
              const w = (node.width ?? 0) * sx;
              const h = (node.height ?? 0) * sy;
              expand(node.position.x, node.position.y, w / 2, h / 2);
              return;
            }

            if (node.shape === "circle" || node.shape === "polygon") {
              const r = (node.radius ?? 0) * Math.max(sx, sy);
              expand(node.position.x, node.position.y, r, r);
              return;
            }

            if (node.shape === "line") {
              const points = Array.isArray(node.points)
                ? node.points
                : [0, 0, 0, 0];
              let pMinX = Infinity;
              let pMinY = Infinity;
              let pMaxX = -Infinity;
              let pMaxY = -Infinity;
              for (let i = 0; i < points.length; i += 2) {
                const px = points[i] * sx;
                const py = points[i + 1] * sy;
                pMinX = Math.min(pMinX, px);
                pMaxX = Math.max(pMaxX, px);
                pMinY = Math.min(pMinY, py);
                pMaxY = Math.max(pMaxY, py);
              }
              minX = Math.min(minX, node.position.x + pMinX);
              maxX = Math.max(maxX, node.position.x + pMaxX);
              minY = Math.min(minY, node.position.y + pMinY);
              maxY = Math.max(maxY, node.position.y + pMaxY);
            }
          });

          if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
            dispatch(setViewport({ position: { x: 0, y: 0 }, scale: 1 }));
            return;
          }

          const boundsW = Math.max(1, maxX - minX);
          const boundsH = Math.max(1, maxY - minY);
          const padding = 40;
          const viewW = Math.max(1, viewportSize.width - padding * 2);
          const viewH = Math.max(1, viewportSize.height - padding * 2);
          const scale = Math.min(viewW / boundsW, viewH / boundsH);
          const centerX = minX + boundsW / 2;
          const centerY = minY + boundsH / 2;

          const newPos = {
            x: viewportSize.width / 2 - centerX * scale,
            y: viewportSize.height / 2 - centerY * scale,
          };

          dispatch(setViewport({ position: newPos, scale }));
        }}
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

  if (selectedIds.length === 0) return null;

  const selectedNode = nodes[selectedIds[0]];
  if (!selectedNode) return null;

  const palette = [
    "#ffffff",
    "#cccccc",
    "#b2b2b2",
    "#e5e5e5",
    "#999999",
    "#7f7f7f",
  ];

  const applyStrokeColor = (color: string | null) => {
    if (selectedNode.type !== "shape") return;
    dispatch(
      updateNode({
        id: selectedNode.id,
        changes: { stroke: color ?? undefined },
      }),
    );
  };

  const applyFillColor = (color: string | null) => {
    if (selectedNode.type !== "shape") return;
    if (selectedNode.shape === "line") return;
    dispatch(
      updateNode({
        id: selectedNode.id,
        changes: { fill: color ?? undefined },
      }),
    );
  };

  const updatePosition = (axis: "x" | "y", value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    dispatch(
      updateNode({
        id: selectedNode.id,
        changes: {
          position: {
            x: axis === "x" ? next : selectedNode.position.x,
            y: axis === "y" ? next : selectedNode.position.y,
          },
        },
      }),
    );
  };

  const updateRotation = (value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    dispatch(
      updateNode({
        id: selectedNode.id,
        changes: { rotation: next },
      }),
    );
  };

  const updateScale = (axis: "x" | "y", value: string) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    dispatch(
      updateNode({
        id: selectedNode.id,
        changes: {
          scaleX: axis === "x" ? next : (selectedNode.scaleX ?? 1),
          scaleY: axis === "y" ? next : (selectedNode.scaleY ?? 1),
        },
      }),
    );
  };

  const estimateTextBox = (text: string, fontSize: number, padding: number) => {
    const width = Math.max(40, text.length * fontSize * 0.6 + padding * 2);
    const height = fontSize + padding * 2;
    return { width, height };
  };

  const updateFontSize = (value: string) => {
    if (selectedNode.type !== "shape" || selectedNode.shape !== "text") return;
    const next = Number(value);
    if (Number.isNaN(next)) return;
    const padding = selectedNode.padding ?? 8;
    const textValue = selectedNode.text ?? "Text";
    const { width, height } = estimateTextBox(textValue, next, padding);
    dispatch(
      updateNode({
        id: selectedNode.id,
        changes: {
          fontSize: next,
          width,
          height,
        },
      }),
    );
  };

  const updateTextValue = (value: string) => {
    if (selectedNode.type !== "shape" || selectedNode.shape !== "text") return;
    const padding = selectedNode.padding ?? 8;
    const fontSize = selectedNode.fontSize ?? 18;
    const { width, height } = estimateTextBox(value, fontSize, padding);
    dispatch(
      updateNode({
        id: selectedNode.id,
        changes: {
          text: value,
          width,
          height,
        },
      }),
    );
  };

  const updateDash = (checked: boolean) => {
    if (selectedNode.type !== "shape") return;
    dispatch(
      updateNode({
        id: selectedNode.id,
        changes: { dash: checked ? [5, 5] : undefined },
      }),
    );
  };

  return (
    <div className="absolute top-4 right-4 z-20 w-64 bg-white dark:bg-zinc-900 p-4 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800">
      <h3 className="font-bold mb-2">Selection</h3>
      <div className="text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-zinc-500">ID:</span>
          <span className="font-mono text-xs">
            {selectedNode.id.slice(0, 8)}...
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Type:</span>
          <span className="capitalize">{selectedNode.type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Rotation:</span>
          <input
            type="number"
            step="1"
            className="w-20 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
            value={Math.round(selectedNode.rotation || 0)}
            onChange={(e) => updateRotation(e.target.value)}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">X / Y:</span>
          <div className="flex gap-2">
            <input
              type="number"
              step="1"
              className="w-16 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
              value={Math.round(selectedNode.position.x)}
              onChange={(e) => updatePosition("x", e.target.value)}
            />
            <input
              type="number"
              step="1"
              className="w-16 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
              value={Math.round(selectedNode.position.y)}
              onChange={(e) => updatePosition("y", e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Scale:</span>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              className="w-16 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
              value={(selectedNode.scaleX ?? 1).toFixed(2)}
              onChange={(e) => updateScale("x", e.target.value)}
            />
            <input
              type="number"
              step="0.01"
              className="w-16 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
              value={(selectedNode.scaleY ?? 1).toFixed(2)}
              onChange={(e) => updateScale("y", e.target.value)}
            />
          </div>
        </div>
      </div>
      {selectedNode.type === "shape" && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Dashed Stroke</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
              checked={Array.isArray(selectedNode.dash) && selectedNode.dash.length > 0}
              onChange={(e) => updateDash(e.target.checked)}
            />
          </div>
          {selectedNode.shape === "text" && (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-zinc-500">Text</span>
              <input
                type="text"
                className="w-full bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-sm"
                value={selectedNode.text ?? "Text"}
                onChange={(e) => updateTextValue(e.target.value)}
              />
            </div>
          )}
          {selectedNode.shape === "text" && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Font Size</span>
              <input
                type="number"
                step="1"
                className="w-20 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 text-right"
                value={Math.round(selectedNode.fontSize ?? 18)}
                onChange={(e) => updateFontSize(e.target.value)}
              />
            </div>
          )}
          <div>
            <div className="text-xs text-zinc-500 mb-2">Stroke Color</div>
            <div className="grid grid-cols-6 gap-2">
              {selectedNode.shape === "text" && (
                <button
                  type="button"
                  className={`h-6 w-6 rounded border text-[10px] uppercase ${
                    !selectedNode.stroke
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                  onClick={() => applyStrokeColor(null)}
                  title="Transparent"
                >
                  T
                </button>
              )}
              {palette.map((color) => (
                <button
                  key={`stroke-${color}`}
                  type="button"
                  className={`h-6 w-6 rounded border ${selectedNode.stroke === color ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-700"}`}
                  style={{ backgroundColor: color }}
                  onClick={() => applyStrokeColor(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
          {selectedNode.shape !== "line" && (
            <div>
              <div className="text-xs text-zinc-500 mb-2">Fill Color</div>
              <div className="grid grid-cols-6 gap-2">
                {selectedNode.shape === "text" && (
                  <button
                    type="button"
                    className={`h-6 w-6 rounded border text-[10px] uppercase ${
                      !selectedNode.fill
                        ? "border-zinc-900 dark:border-zinc-100"
                        : "border-zinc-300 dark:border-zinc-700"
                    }`}
                    onClick={() => applyFillColor(null)}
                    title="Transparent"
                  >
                    T
                  </button>
                )}
                {palette.map((color) => (
                  <button
                    key={`fill-${color}`}
                    type="button"
                    className={`h-6 w-6 rounded border ${selectedNode.fill === color ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-700"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => applyFillColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
