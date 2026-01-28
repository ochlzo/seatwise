"use client";

import * as React from "react";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Circle,
  Line,
  RegularPolygon,
  Text,
  Image as KonvaImage,
} from "react-konva";
import type { SeatmapNode, SeatmapSeatNode, SeatmapShapeNode, GuidePathNode } from "@/lib/seatmap/types";
import { calculateFitViewport } from "@/lib/seatmap/view-utils";
import useImage from "use-image";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import type { KonvaEventObject } from "konva/lib/Node";
import { LocateFixed, Move, MousePointer2, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SeatmapPreviewCategory = {
  category_id: string;
  name: string;
  color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
};

const COLOR_CODE_TO_HEX: Record<SeatmapPreviewCategory["color_code"], string> = {
  NO_COLOR: "transparent",
  GOLD: "#ffd700",
  PINK: "#e005b9",
  BLUE: "#111184",
  BURGUNDY: "#800020",
  GREEN: "#046307",
};

type SeatmapPreviewProps = {
  seatmapId?: string;
  className?: string;
  heightClassName?: string;
  categories?: SeatmapPreviewCategory[];
  allowMarqueeSelection?: boolean;
  allowCategoryAssign?: boolean;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

export function SeatmapPreview({
  seatmapId,
  className,
  heightClassName,
  categories: _categories,
  allowMarqueeSelection = false,
  allowCategoryAssign = false,
}: SeatmapPreviewProps) {
  const categories = _categories ?? [];
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = React.useState<Record<string, SeatmapNode>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 400 });
  const [viewport, setViewport] = React.useState({ position: { x: 0, y: 0 }, scale: 1 });
  const [selectedSeatIds, setSelectedSeatIds] = React.useState<string[]>([]);
  const [seatCategories, setSeatCategories] = React.useState<Record<string, SeatmapPreviewCategory["color_code"]>>({});
  const [isShiftDown, setIsShiftDown] = React.useState(false);
  const [isCtrlDown, setIsCtrlDown] = React.useState(false);
  const [mode, setMode] = React.useState<"select" | "pan">("select");
  const [zoomLocked, setZoomLocked] = React.useState(false);
  const [isPanning, setIsPanning] = React.useState(false);
  const lastStagePointerPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const stageRef = React.useRef<KonvaStage | null>(null);
  const marqueeStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = React.useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  React.useEffect(() => {
    if (!seatmapId) {
      setNodes({});
      setError(null);
      return;
    }
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/seatmaps/${seatmapId}`);
        if (!response.ok) {
          throw new Error("Failed to load seatmap");
        }
        const data = await response.json();
        if (!isMounted) return;
        setNodes((data?.seatmap_json?.nodes ?? {}) as Record<string, SeatmapNode>);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Unable to load seatmap");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [seatmapId]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDimensions({
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftDown(true);
      if (e.key === "Control" || e.key === "Meta") setIsCtrlDown(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftDown(false);
      if (e.key === "Control" || e.key === "Meta") setIsCtrlDown(false);
    };
    const handleBlur = () => {
      setIsShiftDown(false);
      setIsCtrlDown(false);
      marqueeStartRef.current = null;
      setMarqueeRect((prev) => ({ ...prev, visible: false }));
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  React.useEffect(() => {
    setViewport(calculateFitViewport(nodes, dimensions));
    setSelectedSeatIds([]);
    setMarqueeRect((prev) => ({ ...prev, visible: false }));
    marqueeStartRef.current = null;
    setSeatCategories({});
  }, [nodes, dimensions]);

  const handleWheel = (e: { evt: WheelEvent; target: { getStage: () => KonvaStage | null } }) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = viewport.scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const isZoom = e.evt.ctrlKey === true;
    if (isZoom) {
      if (zoomLocked) return;
      const scaleBy = 1.06;
      const nextScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));

      const mousePointTo = {
        x: (pointer.x - viewport.position.x) / oldScale,
        y: (pointer.y - viewport.position.y) / oldScale,
      };
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      setViewport({ position: newPos, scale: newScale });
      return;
    }

    setViewport((prev) => ({
      position: {
        x: prev.position.x - e.evt.deltaX,
        y: prev.position.y - e.evt.deltaY,
      },
      scale: prev.scale,
    }));
  };

  const handleDragEnd = (e: { target: { getStage: () => KonvaStage | null } }) => {
    const stage = e.target.getStage();
    if (!stage) return;
    setViewport((prev) => ({
      position: { x: stage.x(), y: stage.y() },
      scale: prev.scale,
    }));
  };

  const getWorldPointer = (stage: KonvaStage) => {
    const p = stage.getPointerPosition();
    if (!p) return null;
    const t = stage.getAbsoluteTransform().copy().invert();
    return t.point(p);
  };

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (mode === "pan") {
      setIsPanning(true);
      lastStagePointerPosRef.current = e.target.getStage()?.getPointerPosition() ?? null;
      return;
    }
    if (!allowMarqueeSelection) return;
    const stage = e.target.getStage();
    if (!stage || e.evt.button !== 0) return;
    if (e.target !== stage) return;
    const pos = getWorldPointer(stage);
    if (!pos) return;
    marqueeStartRef.current = pos;
    setMarqueeRect({ x: pos.x, y: pos.y, width: 0, height: 0, visible: true });
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (mode === "pan" && isPanning) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pointerPos = stage.getPointerPosition();
      const lastPos = lastStagePointerPosRef.current;
      if (pointerPos && lastPos) {
        const dx = pointerPos.x - lastPos.x;
        const dy = pointerPos.y - lastPos.y;
        setViewport((prev) => ({
          position: { x: prev.position.x + dx, y: prev.position.y + dy },
          scale: prev.scale,
        }));
        lastStagePointerPosRef.current = pointerPos;
      }
      return;
    }
    if (!allowMarqueeSelection || !marqueeStartRef.current) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getWorldPointer(stage);
    if (!pos) return;
    const start = marqueeStartRef.current;
    const x = Math.min(start.x, pos.x);
    const y = Math.min(start.y, pos.y);
    const width = Math.abs(pos.x - start.x);
    const height = Math.abs(pos.y - start.y);
    setMarqueeRect({ x, y, width, height, visible: true });
  };

  const handleStageMouseUp = () => {
    if (mode === "pan") {
      setIsPanning(false);
      lastStagePointerPosRef.current = null;
      return;
    }
    if (!allowMarqueeSelection || !marqueeStartRef.current) return;
    const stage = stageRef.current;
    if (stage) {
      const { x, y, width, height } = marqueeRect;
      const intersectingIds = stage
        .find(".selectable")
        .filter((node) => {
          const rect = node.getClientRect({ relativeTo: stage });
          return (
            rect.x < x + width &&
            rect.x + rect.width > x &&
            rect.y < y + height &&
            rect.y + rect.height > y
          );
        })
        .map((node) => node.id() || node.getParent()?.id())
        .filter(Boolean) as string[];

      setSelectedSeatIds((prev) => {
        if (isShiftDown || isCtrlDown) {
          const merged = new Set(prev);
          intersectingIds.forEach((id) => merged.add(id));
          return Array.from(merged);
        }
        return intersectingIds;
      });
    }
    marqueeStartRef.current = null;
    setMarqueeRect((prev) => ({ ...prev, visible: false }));
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (mode !== "select") return;
    const stage = e.target.getStage();
    if (!stage) return;
    const additive = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
    if (e.target === stage) {
      if (!additive) setSelectedSeatIds([]);
      return;
    }
    if (!e.target.hasName("seat-item") && !e.target.hasName("seat-image")) {
      if (!additive) setSelectedSeatIds([]);
    }
  };

  return (
    <div className={`rounded-lg border border-sidebar-border/60 bg-zinc-50/50 p-3 ${className ?? ""}`.trim()}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">Seatmap Preview</p>
        <p className="text-[10px] text-muted-foreground">Scroll to pan, Ctrl + scroll to zoom</p>
      </div>
      <div
        ref={containerRef}
        className={`relative mt-3 w-full overflow-hidden rounded-md border border-sidebar-border/60 bg-white ${heightClassName ?? "h-[320px]"}`}
      >
        <div className={cn(
          "absolute z-10 flex flex-col gap-2 bg-white shadow-lg border border-zinc-200 dark:border-zinc-800",
          "left-4 top-4 p-2 rounded-lg",
          "sm:left-4 sm:top-4 left-2 top-2 sm:p-2 p-1.5 sm:rounded-lg rounded-md",
          "sm:gap-2 gap-1.5"
        )}>
          <Button
            variant={mode === "select" ? "default" : "ghost"}
            size="icon"
            onClick={() => setMode("select")}
            title="Select Mode"
            className="h-9 w-9 sm:h-9 sm:w-9 h-8 w-8"
          >
            <MousePointer2 className="h-4 w-4 sm:h-4 sm:w-4 h-3.5 w-3.5" />
          </Button>
          <Button
            variant={mode === "pan" ? "default" : "ghost"}
            size="icon"
            onClick={() => setMode("pan")}
            title="Pan Mode"
            className="h-9 w-9 sm:h-9 sm:w-9 h-8 w-8"
          >
            <Move className="h-4 w-4 sm:h-4 sm:w-4 h-3.5 w-3.5" />
          </Button>
          <div className="h-px w-full bg-zinc-200 dark:bg-zinc-700 sm:my-1 my-0.5" />
          <Button
            variant={zoomLocked ? "default" : "ghost"}
            size="icon"
            onClick={() => setZoomLocked((prev) => !prev)}
            title={zoomLocked ? "Unlock Zoom" : "Lock Zoom"}
            className="h-9 w-9 sm:h-9 sm:w-9 h-8 w-8"
          >
            {zoomLocked ? (
              <Lock className="h-4 w-4 sm:h-4 sm:w-4 h-3.5 w-3.5" />
            ) : (
              <Unlock className="h-4 w-4 sm:h-4 sm:w-4 h-3.5 w-3.5" />
            )}
          </Button>
          <div className="h-px w-full bg-zinc-200 dark:bg-zinc-700 sm:my-1 my-0.5" />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 sm:h-9 sm:w-9 h-8 w-8"
            onClick={() => setViewport(calculateFitViewport(nodes, dimensions))}
            title="Reset View"
          >
            <LocateFixed className="h-4 w-4 sm:h-4 sm:w-4 h-3.5 w-3.5" />
          </Button>
        </div>
        {allowCategoryAssign && selectedSeatIds.length > 0 && (
          <div className="absolute right-3 top-3 z-10 w-52 rounded-lg border border-zinc-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-zinc-700">Assign Category</span>
              <span className="text-[10px] text-zinc-400">
                {selectedSeatIds.length} seat{selectedSeatIds.length === 1 ? "" : "s"}
              </span>
            </div>
            {categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center text-zinc-500">
                <span className="text-[11px]">Add categories first</span>
              </div>
            ) : (
              (() => {
                const selectedCategoryCodes = new Set(
                  selectedSeatIds
                    .map((id) => seatCategories[id])
                    .filter((code): code is SeatmapPreviewCategory["color_code"] => Boolean(code))
                );
                const hasSelection = selectedCategoryCodes.size > 0;
                return (
                  <div className="flex flex-col gap-2">
                    {categories.map((category) => {
                      const isAssigned = selectedCategoryCodes.has(category.color_code);
                      return (
                        <button
                          key={category.category_id}
                          type="button"
                          className={cn(
                            "flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50",
                            isAssigned
                              ? "border-primary ring-1 ring-primary/40"
                              : "border-zinc-200",
                            !hasSelection && "border-zinc-200"
                          )}
                          onClick={() => {
                            setSeatCategories((prev) => {
                              const next = { ...prev };
                              selectedSeatIds.forEach((id) => {
                                next[id] = category.color_code;
                              });
                              return next;
                            });
                          }}
                        >
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full border border-zinc-300",
                              category.color_code === "NO_COLOR" && "bg-transparent"
                            )}
                            style={{
                              backgroundColor:
                                category.color_code === "NO_COLOR"
                                  ? "transparent"
                                  : COLOR_CODE_TO_HEX[category.color_code],
                              backgroundImage:
                                category.color_code === "NO_COLOR"
                                  ? "linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 50%, #e2e8f0 50%, #e2e8f0 75%, transparent 75%, transparent)"
                                  : undefined,
                              backgroundSize:
                                category.color_code === "NO_COLOR" ? "6px 6px" : undefined,
                            }}
                          />
                          <span className="truncate">{category.name || "Untitled"}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                      onClick={() => {
                        setSeatCategories((prev) => {
                          const next = { ...prev };
                          selectedSeatIds.forEach((id) => {
                            delete next[id];
                          });
                          return next;
                        });
                      }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full border border-zinc-300 bg-transparent" />
                      <span>Clear</span>
                    </button>
                  </div>
                );
              })()
            )}
          </div>
        )}
        {!seatmapId && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Select a seatmap to preview.
          </div>
        )}
        {seatmapId && isLoading && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading seatmap...
          </div>
        )}
        {seatmapId && !isLoading && error && (
          <div className="flex h-full items-center justify-center text-xs text-red-600">
            {error}
          </div>
        )}
        {seatmapId && !isLoading && !error && (
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            draggable={mode === "pan"}
            onDragEnd={handleDragEnd}
            onWheel={handleWheel}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onClick={handleStageClick}
            onTap={handleStageClick}
            x={viewport.position.x}
            y={viewport.position.y}
            scaleX={viewport.scale}
            scaleY={viewport.scale}
            ref={(node) => {
              stageRef.current = node;
            }}
          >
            <Layer>
              {marqueeRect.visible && (
                <Rect
                  x={marqueeRect.x}
                  y={marqueeRect.y}
                  width={marqueeRect.width}
                  height={marqueeRect.height}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  dash={[4, 4]}
                  fill="rgba(59, 130, 246, 0.12)"
                  listening={false}
                />
              )}
              <SeatNodes
                nodes={nodes}
                selectedSeatIds={selectedSeatIds}
                onSelectSeat={setSelectedSeatIds}
                isShiftDown={isShiftDown}
                isCtrlDown={isCtrlDown}
                seatCategories={seatCategories}
              />
              <ShapeNodes nodes={nodes} />
              <GuidePathNodes nodes={nodes} />
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}

function SeatNodes({
  nodes,
  selectedSeatIds,
  onSelectSeat,
  isShiftDown,
  isCtrlDown,
  seatCategories,
}: {
  nodes: Record<string, SeatmapNode>;
  selectedSeatIds: string[];
  onSelectSeat: (ids: string[]) => void;
  isShiftDown: boolean;
  isCtrlDown: boolean;
  seatCategories: Record<string, SeatmapPreviewCategory["color_code"]>;
}) {
  const seats = Object.values(nodes).filter((node): node is SeatmapSeatNode => node.type === "seat");
  const [defaultImage] = useImage("/seat-default.svg");
  const [goldImage] = useImage("/vip-seat-1.svg");
  const [pinkImage] = useImage("/vip-seat-2.svg");
  const [blueImage] = useImage("/vip-seat-3.svg");
  const [burgundyImage] = useImage("/vip-seat-4.svg");
  const [greenImage] = useImage("/vip-seat-5.svg");

  return (
    <>
      {seats.map((seat) => {
        const label = `${seat.rowLabel ?? ""}${seat.seatNumber ?? ""}`;
        const isSelected = selectedSeatIds.includes(seat.id);
        const colorCode = seatCategories[seat.id] ?? "NO_COLOR";
        const image =
          colorCode === "GOLD"
            ? goldImage
            : colorCode === "PINK"
              ? pinkImage
              : colorCode === "BLUE"
                ? blueImage
                : colorCode === "BURGUNDY"
                  ? burgundyImage
                  : colorCode === "GREEN"
                    ? greenImage
                    : defaultImage;
        return (
          <Group
            key={seat.id}
            id={seat.id}
            x={seat.position.x}
            y={seat.position.y}
            width={32}
            height={32}
            offsetX={16}
            offsetY={16}
            rotation={seat.rotation}
            scaleX={seat.scaleX}
            scaleY={seat.scaleY}
            name="seat-item selectable"
            onClick={(e) => {
              e.cancelBubble = true;
              if (isShiftDown || isCtrlDown) {
                onSelectSeat(
                  isSelected
                    ? selectedSeatIds.filter((id) => id !== seat.id)
                    : [...selectedSeatIds, seat.id],
                );
                return;
              }
              onSelectSeat([seat.id]);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              if (isShiftDown || isCtrlDown) {
                onSelectSeat(
                  isSelected
                    ? selectedSeatIds.filter((id) => id !== seat.id)
                    : [...selectedSeatIds, seat.id],
                );
                return;
              }
              onSelectSeat([seat.id]);
            }}
          >
            <KonvaImage image={image} width={32} height={32} name="seat-image" />
            {isSelected && (
              <Rect
                x={16}
                y={16}
                width={32}
                height={32}
                offsetX={16}
                offsetY={16}
                stroke="#3b82f6"
                strokeWidth={2}
                cornerRadius={4}
                listening={false}
              />
            )}
            {label && (
              <Text
                text={label}
                x={16}
                y={16}
                width={32}
                height={32}
                offsetX={16}
                offsetY={16}
                rotation={-(seat.rotation ?? 0)}
                fontSize={10}
                fontStyle="bold"
                fill="#4b5563"
                align="center"
                verticalAlign="middle"
                listening={false}
              />
            )}
          </Group>
        );
      })}
    </>
  );
}

function ShapeNodes({ nodes }: { nodes: Record<string, SeatmapNode> }) {
  const shapes = Object.values(nodes).filter((node): node is SeatmapShapeNode => node.type === "shape");

  return (
    <>
      {shapes.map((shape) => {
        const commonProps = {
          x: shape.position.x,
          y: shape.position.y,
          rotation: shape.rotation,
          scaleX: shape.scaleX,
          scaleY: shape.scaleY,
        };

        if (shape.shape === "rect" || shape.shape === "stairs") {
          const width = shape.width ?? 50;
          const height = shape.height ?? 50;
          return (
            <Rect
              key={shape.id}
              {...commonProps}
              width={width}
              height={height}
              offsetX={width / 2}
              offsetY={height / 2}
              fill={shape.fill}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth ?? 2}
              dash={shape.dash}
              cornerRadius={shape.shape === "rect" ? 4 : 2}
            />
          );
        }

        if (shape.shape === "circle") {
          return (
            <Circle
              key={shape.id}
              {...commonProps}
              radius={shape.radius ?? 30}
              fill={shape.fill}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth ?? 2}
              dash={shape.dash}
            />
          );
        }

        if (shape.shape === "polygon") {
          return (
            <RegularPolygon
              key={shape.id}
              {...commonProps}
              radius={shape.radius ?? 30}
              sides={shape.sides ?? 6}
              fill={shape.fill}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth ?? 2}
              dash={shape.dash}
            />
          );
        }

        if (shape.shape === "line") {
          return (
            <Line
              key={shape.id}
              {...commonProps}
              points={shape.points ?? [0, 0, 100, 0]}
              stroke={shape.stroke ?? "#64748b"}
              strokeWidth={shape.strokeWidth ?? 2}
              dash={shape.dash}
              lineCap="round"
              lineJoin="round"
            />
          );
        }

        if (shape.shape === "text") {
          const value = shape.text ?? "Text";
          const fontSize = shape.fontSize ?? 18;
          const fontFamily = shape.fontFamily ?? "Inter";
          const textColor = shape.textColor ?? "#111827";
          const padding = shape.padding ?? 8;
          const width = shape.width ?? Math.max(40, value.length * fontSize * 0.6 + padding * 2);
          const height = shape.height ?? fontSize + padding * 2;
          return (
            <Group key={shape.id} {...commonProps} offsetX={width / 2} offsetY={height / 2}>
              <Rect
                width={width}
                height={height}
                fill={shape.fill}
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth ?? 2}
                dash={shape.dash}
                cornerRadius={4}
              />
              <Text
                x={padding}
                y={padding}
                width={Math.max(0, width - padding * 2)}
                height={Math.max(0, height - padding * 2)}
                text={value}
                fontSize={fontSize}
                fontFamily={fontFamily}
                fill={textColor}
                align="center"
                verticalAlign="middle"
              />
            </Group>
          );
        }

        return null;
      })}
    </>
  );
}

function GuidePathNodes({ nodes }: { nodes: Record<string, SeatmapNode> }) {
  const guides = Object.values(nodes).filter(
    (node): node is GuidePathNode => node.type === "helper" && node.helperType === "guidePath",
  );

  return (
    <>
      {guides.map((guide) => (
        <Line
          key={guide.id}
          points={guide.points ?? []}
          stroke={guide.stroke ?? "#9ca3af"}
          strokeWidth={guide.strokeWidth ?? 2}
          dash={guide.dash ?? [6, 4]}
          lineCap="round"
          lineJoin="round"
        />
      ))}
    </>
  );
}
