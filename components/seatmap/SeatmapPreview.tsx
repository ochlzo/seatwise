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
import { type SeatmapPreviewCategory, COLOR_CODE_TO_HEX } from "./CategoryAssignPanel";



type SeatmapPreviewProps = {
  seatmapId?: string;
  className?: string;
  heightClassName?: string;
  allowMarqueeSelection?: boolean;
  // Controlled selection props
  selectedSeatIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  // Controlled category assignment props (maps seat ID -> category ID)
  categories?: SeatmapPreviewCategory[];
  seatCategories?: Record<string, string>;
  onSeatCategoriesChange?: (categories: Record<string, string>) => void;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

export function SeatmapPreview({
  seatmapId,
  className,
  heightClassName,
  allowMarqueeSelection = false,
  selectedSeatIds: controlledSelectedIds,
  onSelectionChange,
  categories = [],
  seatCategories: controlledSeatCategories,
  onSeatCategoriesChange,
}: SeatmapPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = React.useState<Record<string, SeatmapNode>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 400 });
  const [viewport, setViewport] = React.useState({ position: { x: 0, y: 0 }, scale: 1 });

  // Support both controlled and uncontrolled selection
  const [internalSelectedIds, setInternalSelectedIds] = React.useState<string[]>([]);
  const selectedSeatIds = controlledSelectedIds ?? internalSelectedIds;

  const setSelectedSeatIds = React.useCallback((ids: string[] | ((prev: string[]) => string[])) => {
    if (onSelectionChange) {
      // For controlled mode, we need the current value if it's a functional update
      // Since we can't easily get it without adding a dependency, we'll just handle the direct value case
      // and assume functional updates are mostly used in uncontrolled mode or the parent handles it.
      // Alternatively, we could use a ref, but let's keep it simple for now.
      const nextIds = typeof ids === "function" ? ids(selectedSeatIds) : ids;
      onSelectionChange(nextIds);
    } else {
      setInternalSelectedIds(ids);
    }
  }, [onSelectionChange, selectedSeatIds]);

  // Support both controlled and uncontrolled category state (maps seat ID -> category ID)
  const [internalSeatCategories, setInternalSeatCategories] = React.useState<Record<string, string>>({});
  const seatCategories = controlledSeatCategories ?? internalSeatCategories;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setSeatCategories = React.useCallback((update: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    if (onSeatCategoriesChange) {
      const nextCategories = typeof update === "function" ? update(seatCategories) : update;
      onSeatCategoriesChange(nextCategories);
    } else {
      setInternalSeatCategories(update);
    }
  }, [onSeatCategoriesChange, seatCategories]);

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

  // Reset viewport and selection/categories when nodes or dimensions change
  React.useEffect(() => {
    setViewport(calculateFitViewport(nodes, dimensions));
    setInternalSelectedIds([]);
    setInternalSeatCategories({});
    setMarqueeRect((prev) => ({ ...prev, visible: false }));
    marqueeStartRef.current = null;
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
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-md border border-sidebar-border/60 bg-white ${heightClassName ?? "h-[320px]"} ${className ?? ""}`.trim()}
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
              categories={categories}
              seatCategories={seatCategories}
            />
            <ShapeNodes nodes={nodes} />
            <GuidePathNodes nodes={nodes} />
          </Layer>
        </Stage>
      )}
    </div>
  );
}

function SeatNodes({
  nodes,
  selectedSeatIds,
  onSelectSeat,
  isShiftDown,
  isCtrlDown,
  categories,
  seatCategories,
}: {
  nodes: Record<string, SeatmapNode>;
  selectedSeatIds: string[];
  onSelectSeat: (ids: string[]) => void;
  isShiftDown: boolean;
  isCtrlDown: boolean;
  categories: SeatmapPreviewCategory[];
  seatCategories: Record<string, string>;
}) {
  const seats = Object.values(nodes).filter((node): node is SeatmapSeatNode => node.type === "seat");
  const [defaultImage] = useImage("/seat-default.svg");
  const [goldImage] = useImage("/vip-seat-1.svg");
  const [pinkImage] = useImage("/vip-seat-2.svg");
  const [blueImage] = useImage("/vip-seat-3.svg");
  const [burgundyImage] = useImage("/vip-seat-4.svg");
  const [greenImage] = useImage("/vip-seat-5.svg");

  // Calculate contrasting text color based on background luminance
  const getContrastingTextColor = (colorCode: SeatmapPreviewCategory["color_code"]) => {
    const hex = COLOR_CODE_TO_HEX[colorCode];
    if (!hex || hex === "transparent") return "#4b5563"; // Default gray for no color

    // Parse hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Calculate relative luminance (WCAG formula)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Use white text for dark backgrounds, dark text for light backgrounds
    return luminance > 0.5 ? "#1f2937" : "#ffffff";
  };

  return (
    <>
      {seats.map((seat) => {
        const label = `${seat.rowLabel ?? ""}${seat.seatNumber ?? ""}`;
        const isSelected = selectedSeatIds.includes(seat.id);
        // Look up the category by ID to get the current color_code
        const categoryId = seatCategories[seat.id];
        const category = categoryId ? categories.find(c => c.category_id === categoryId) : null;

        // DEBUG: Trace why lookup might fail
        if (categoryId && !category) {
          console.warn(`SeatNodes: Found assignment ${categoryId} for seat ${seat.id} but no matching category in list`, categories);
        }

        const colorCode = category?.color_code ?? "NO_COLOR";
        const textColor = getContrastingTextColor(colorCode);
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
                fill={textColor}
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
