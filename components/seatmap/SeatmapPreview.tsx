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
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";

type SeatmapPreviewProps = {
  seatmapId?: string;
  className?: string;
  heightClassName?: string;
  categories?: Array<{
    category_id: string;
    name: string;
    color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
  }>;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

export function SeatmapPreview({ seatmapId, className, heightClassName, categories }: SeatmapPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = React.useState<Record<string, SeatmapNode>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 400 });
  const [viewport, setViewport] = React.useState({ position: { x: 0, y: 0 }, scale: 1 });

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
    setViewport(calculateFitViewport(nodes, dimensions));
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
        <div className="absolute left-4 top-4 z-10">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-9 w-9"
            onClick={() => setViewport(calculateFitViewport(nodes, dimensions))}
            title="Reset View"
          >
            <LocateFixed className="h-4 w-4" />
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
            draggable
            onDragEnd={handleDragEnd}
            onWheel={handleWheel}
            x={viewport.position.x}
            y={viewport.position.y}
            scaleX={viewport.scale}
            scaleY={viewport.scale}
          >
            <Layer>
              <SeatNodes nodes={nodes} />
              <ShapeNodes nodes={nodes} />
              <GuidePathNodes nodes={nodes} />
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}

function SeatNodes({ nodes }: { nodes: Record<string, SeatmapNode> }) {
  const seats = Object.values(nodes).filter((node): node is SeatmapSeatNode => node.type === "seat");
  const [image] = useImage("/seat-default.svg");

  return (
    <>
      {seats.map((seat) => {
        const label = `${seat.rowLabel ?? ""}${seat.seatNumber ?? ""}`;
        return (
          <Group
            key={seat.id}
            x={seat.position.x}
            y={seat.position.y}
            width={32}
            height={32}
            offsetX={16}
            offsetY={16}
            rotation={seat.rotation}
            scaleX={seat.scaleX}
            scaleY={seat.scaleY}
          >
            <KonvaImage image={image} width={32} height={32} />
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
