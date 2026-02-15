"use client";

import React from "react";
import {
  Image as KonvaImage,
  Group,
  // Rect,
  Transformer,
  Text,
} from "react-konva";
import useImage from "use-image";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Node as KonvaNode } from "konva/lib/Node";
import type { Group as KonvaGroup } from "konva/lib/Group";
import type { Transformer as KonvaTransformer } from "konva/lib/shapes/Transformer";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
  selectNode,
  toggleSelectNode,
  updateNode,
  updateNodesPositions,
  // updateNodes,
} from "@/lib/features/seatmap/seatmapSlice";
import {
  // closestPointOnPolyline,
  getNodeBoundingBox,
  getSnapResults,
} from "@/lib/seatmap/geometry";
import type {
  GuidePathNode,
  SeatCategory,
  SeatmapNode,
  SeatmapSeatNode,
} from "@/lib/seatmap/types";
import { useTheme } from "next-themes";

const ROTATION_SNAP = 15;
const MIN_SIZE = 16;
const MAX_SIZE = 320;

const COLOR_TO_SVG: Record<string, string> = {
  "#ffd700": "/vip-seat-1.svg",
  "#e005b9": "/vip-seat-2.svg",
  "#111184": "/vip-seat-3.svg",
  "#800020": "/vip-seat-4.svg",
  "#046307": "/vip-seat-5.svg",
};

type SeatItemProps = {
  seat: SeatmapSeatNode;
  isSelected: boolean;
  onSelect: (
    id: string,
    evt?: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => void;
  onChange: (
    id: string,
    changes: Partial<SeatmapSeatNode>,
    history?: boolean,
  ) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isShiftDown: boolean;
  onMultiDragStart?: (id: string, pos: { x: number; y: number }) => boolean;
  onMultiDragMove?: (id: string, pos: { x: number; y: number }) => boolean;
  onMultiDragEnd?: (id: string, pos: { x: number; y: number }) => boolean;
  showGuidePaths: boolean;
  guidePaths: GuidePathNode[];
  onSnap: (lines: {
    x: number | null;
    y: number | null;
    isSpacingX?: boolean;
    isSpacingY?: boolean;
    spacingValue?: number;
  }) => void;
  nodes: Record<string, SeatmapNode>;
  selectionCount: number;
  snapSpacing: number;
  categories: SeatCategory[];
};

const SeatItem = React.memo(
  ({
    seat,
    isSelected,
    onSelect,
    onChange,
    onDragStart,
    onDragEnd,
    isShiftDown,
    onMultiDragStart,
    onMultiDragMove,
    onMultiDragEnd,
    // showGuidePaths,
    // guidePaths,
    onSnap,
    nodes,
    selectionCount,
    snapSpacing,
    categories,
  }: SeatItemProps) => {
    const { theme, resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark" || theme === "dark";

    let imageUrl = isDark ? "/seat-default-darkmode.svg" : "/seat-default.svg";

    if (seat.categoryId) {
      const category = categories.find((c) => c.id === seat.categoryId);
      if (category && COLOR_TO_SVG[category.color]) {
        imageUrl = COLOR_TO_SVG[category.color];
      }
    }

    const label = `${seat.rowLabel ?? ""}${seat.seatNumber ?? ""}`;
    const getLabelColor = () => {
      if (!seat.categoryId) return "#4b5563"; // gray-600
      const category = categories.find((c) => c.id === seat.categoryId);
      if (!category) return "#4b5563";
      if (category.color === "#ffd700") return "#000000"; // Gold gets black
      if (category.color === "transparent") return "#4b5563"; // Use default for Regular
      return "#ffffff"; // Dark colors get white
    };

    const [image] = useImage(imageUrl);
    const groupRef = React.useRef<KonvaGroup | null>(null);
    const transformerRef = React.useRef<KonvaTransformer | null>(null);
    const rafRef = React.useRef<number | null>(null);
    const pendingPosRef = React.useRef<{ x: number; y: number } | null>(null);

    React.useEffect(() => {
      if (isSelected && transformerRef.current && groupRef.current) {
        transformerRef.current.nodes([groupRef.current]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }, [isSelected]);

    const flushDragPosition = () => {
      if (!pendingPosRef.current) return;
      onChange(
        seat.id,
        {
          position: pendingPosRef.current,
        },
        false,
      );
      pendingPosRef.current = null;
      rafRef.current = null;
    };

    const applyTransform = (evt?: Event, history?: boolean) => {
      if (!groupRef.current) return;
      let rotation = groupRef.current.rotation();
      const shiftKey =
        (evt && "shiftKey" in evt ? (evt as MouseEvent).shiftKey : false) ||
        isShiftDown;
      if (shiftKey) {
        rotation = Math.round(rotation / ROTATION_SNAP) * ROTATION_SNAP;
        groupRef.current.rotation(rotation);
      }
      const scaleX = groupRef.current.scaleX();
      const scaleY = scaleX;
      groupRef.current.scaleY(scaleY);
      rotation = ((rotation % 360) + 360) % 360;
      onChange(seat.id, { rotation, scaleX, scaleY }, history);
    };

    return (
      <>
        <Group
          ref={groupRef}
          x={seat.position.x}
          y={seat.position.y}
          width={32}
          height={32}
          offsetX={16}
          offsetY={16}
          rotation={seat.rotation ?? 0}
          scaleX={seat.scaleX}
          scaleY={seat.scaleY}
          draggable={isSelected}
          onDragStart={() => {
            if (onDragStart) onDragStart();
            if (onMultiDragStart) {
              onMultiDragStart(seat.id, {
                x: seat.position.x,
                y: seat.position.y,
              });
            }
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            onSelect(seat.id, e);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onSelect(seat.id, e);
          }}
          onDragEnd={(e) => {
            const handled = onMultiDragEnd
              ? onMultiDragEnd(seat.id, {
                x: e.target.x(),
                y: e.target.y(),
              })
              : false;
            if (rafRef.current !== null) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            pendingPosRef.current = null;
            if (!handled) {
              const nextPos = { x: e.target.x(), y: e.target.y() };

              const draggedBB = getNodeBoundingBox({
                type: "seat",
                position: nextPos,
                scaleX: seat.scaleX,
                scaleY: seat.scaleY,
              });

              let bestSnapX: number | null = null;
              let bestSnapY: number | null = null;
              let isSpacingX = false;
              let isSpacingY = false;

              if (draggedBB) {
                const snap = getSnapResults(
                  draggedBB,
                  Object.values(nodes),
                  [seat.id],
                  snapSpacing,
                );
                nextPos.x = snap.x;
                nextPos.y = snap.y;
                bestSnapX = snap.snapX;
                bestSnapY = snap.snapY;
                isSpacingX = snap.isSpacingX;
                isSpacingY = snap.isSpacingY;
              }

              e.target.position(nextPos);

              onSnap({
                x: bestSnapX,
                y: bestSnapY,
                isSpacingX,
                isSpacingY,
                spacingValue: snapSpacing,
              });

              onChange(
                seat.id,
                {
                  position: nextPos,
                },
                true,
              );
            }
            onSnap({ x: null, y: null });
            if (onDragEnd) onDragEnd();
          }}
          onDragMove={(e) => {
            const handled = onMultiDragMove
              ? onMultiDragMove(seat.id, {
                x: e.target.x(),
                y: e.target.y(),
              })
              : false;
            if (handled) return;
            const nextPos = { x: e.target.x(), y: e.target.y() };

            const draggedBB = getNodeBoundingBox({
              type: "seat",
              position: nextPos,
              scaleX: seat.scaleX,
              scaleY: seat.scaleY,
            });

            let bestSnapX: number | null = null;
            let bestSnapY: number | null = null;
            let isSpacingX = false;
            let isSpacingY = false;

            if (draggedBB) {
              const snap = getSnapResults(
                draggedBB,
                Object.values(nodes),
                [seat.id],
                snapSpacing,
              );
              nextPos.x = snap.x;
              nextPos.y = snap.y;
              bestSnapX = snap.snapX;
              bestSnapY = snap.snapY;
              isSpacingX = snap.isSpacingX;
              isSpacingY = snap.isSpacingY;
            }

            e.target.position(nextPos);

            onSnap({
              x: bestSnapX,
              y: bestSnapY,
              isSpacingX,
              isSpacingY,
              spacingValue: snapSpacing,
            });
            pendingPosRef.current = nextPos;
            if (rafRef.current === null) {
              rafRef.current = requestAnimationFrame(flushDragPosition);
            }
          }}
          onTransform={(e) => applyTransform(e?.evt, false)}
          onTransformEnd={(e) => applyTransform(e?.evt, true)}
          id={seat.id}
          name="seat-group seat-item selectable"
        >
          <KonvaImage
            image={image}
            width={32}
            height={32}
            name="seat-image"
            shadowColor="black"
            shadowBlur={isSelected ? 5 : 0}
            shadowOpacity={0.3}
          />
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
              fill={getLabelColor()}
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          )}
        </Group>
        {isSelected && selectionCount === 1 && (
          <Transformer
            ref={transformerRef}
            rotateEnabled
            resizeEnabled
            keepRatio
            boundBoxFunc={(oldBox, newBox) => {
              if (
                newBox.width < MIN_SIZE ||
                newBox.height < MIN_SIZE ||
                newBox.width > MAX_SIZE ||
                newBox.height > MAX_SIZE
              ) {
                return oldBox;
              }
              return newBox;
            }}
            rotateAnchorOffset={24}
          />
        )}
      </>
    );
  },
  (prev, next) => {
    return (
      prev.seat === next.seat &&
      prev.isSelected === next.isSelected &&
      prev.selectionCount === next.selectionCount &&
      prev.isShiftDown === next.isShiftDown &&
      prev.showGuidePaths === next.showGuidePaths &&
      prev.guidePaths.length === next.guidePaths.length &&
      prev.categories === next.categories
    );
  },
);

SeatItem.displayName = "SeatItem";

export default function SeatLayer({
  onNodeDragStart,
  onNodeDragEnd,
  stageRef,
  onSnap,
  snapSpacing,
}: {
  onNodeDragStart?: () => void;
  onNodeDragEnd?: () => void;
  stageRef?: React.RefObject<KonvaStage>;
  onSnap: (lines: {
    x: number | null;
    y: number | null;
    isSpacingX?: boolean;
    isSpacingY?: boolean;
    spacingValue?: number;
  }) => void;
  snapSpacing: number;
}) {
  const nodes = useAppSelector((state) => state.seatmap.nodes);
  const selectedIds = useAppSelector((state) => state.seatmap.selectedIds);
  const showGuidePaths = useAppSelector(
    (state) => state.seatmap.showGuidePaths,
  );
  const categories = useAppSelector((state) => state.seatmap.categories || []);
  const selectionCount = selectedIds.length;
  const dispatch = useAppDispatch();
  const [isShiftDown, setIsShiftDown] = React.useState(false);
  const multiDragRef = React.useRef<{
    active: boolean;
    draggedId: string | null;
    startPositions: Record<string, { x: number; y: number }>;
  }>({ active: false, draggedId: null, startPositions: {} });
  const multiDragRafRef = React.useRef<number | null>(null);
  const pendingMultiDragRef = React.useRef<Record<
    string,
    { x: number; y: number }
  > | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftDown(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftDown(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const seats = Object.values(nodes).filter((node) => node.type === "seat");
  const guidePaths = Object.values(nodes).filter(
    (node): node is GuidePathNode =>
      node.type === "helper" && node.helperType === "guidePath",
  );

  const multiDragKonvaNodesRef = React.useRef<Record<string, KonvaNode>>({});

  const beginMultiDrag = (id: string, pos: { x: number; y: number }) => {
    if (!selectedIds.includes(id) || selectedIds.length < 2) return false;
    const startPositions: Record<string, { x: number; y: number }> = {};
    const konvaNodes: Record<string, KonvaNode> = {};
    const stage = stageRef?.current;

    selectedIds.forEach((selectedId) => {
      const node = nodes[selectedId];
      if (!node || node.type !== "seat") return;
      startPositions[selectedId] =
        selectedId === id
          ? { x: pos.x, y: pos.y }
          : { x: node.position.x, y: node.position.y };
      if (stage) {
        const konvaNode = stage.findOne(`#${selectedId}`);
        if (konvaNode) {
          konvaNodes[selectedId] = konvaNode;
        }
      }
    });
    multiDragRef.current = {
      active: true,
      draggedId: id,
      startPositions,
    };
    multiDragKonvaNodesRef.current = konvaNodes;
    return true;
  };

  const updateMultiDrag = (id: string, pos: { x: number; y: number }) => {
    const state = multiDragRef.current;
    if (!state.active || state.draggedId !== id) return false;
    const origin = state.startPositions[id];
    if (!origin) return false;
    let dx = pos.x - origin.x;
    let dy = pos.y - origin.y;

    // Disable all snap behavior during multi-seat drag for smooth grouped movement.
    onSnap({ x: null, y: null });
    const positions: Record<string, { x: number; y: number }> = {};
    Object.entries(state.startPositions).forEach(([nodeId, start]) => {
      positions[nodeId] = { x: start.x + dx, y: start.y + dy };
    });
    pendingMultiDragRef.current = positions;
    if (multiDragRafRef.current === null) {
      multiDragRafRef.current = requestAnimationFrame(() => {
        if (pendingMultiDragRef.current) {
          const konvaNodes = multiDragKonvaNodesRef.current;
          Object.entries(pendingMultiDragRef.current).forEach(
            ([nodeId, next]) => {
              const node = konvaNodes[nodeId];
              if (node) {
                node.position(next);
              }
            },
          );
          if (stageRef?.current) {
            stageRef.current.batchDraw();
          }
          pendingMultiDragRef.current = null;
        }
        multiDragRafRef.current = null;
      });
    }
    return true;
  };

  const endMultiDrag = (id: string, pos: { x: number; y: number }) => {
    const state = multiDragRef.current;
    if (!state.active || state.draggedId !== id) return false;
    const origin = state.startPositions[id];
    if (!origin) return false;
    const dx = pos.x - origin.x;
    const dy = pos.y - origin.y;
    const positions: Record<string, { x: number; y: number }> = {};
    Object.entries(state.startPositions).forEach(([nodeId, start]) => {
      positions[nodeId] = { x: start.x + dx, y: start.y + dy };
    });
    if (multiDragRafRef.current !== null) {
      cancelAnimationFrame(multiDragRafRef.current);
      multiDragRafRef.current = null;
      pendingMultiDragRef.current = null;
    }

    const konvaNodes = multiDragKonvaNodesRef.current;
    Object.entries(positions).forEach(([nodeId, next]) => {
      const node = konvaNodes[nodeId];
      if (node) {
        node.position(next);
      }
    });
    if (stageRef?.current) {
      stageRef.current.batchDraw();
    }
    multiDragRef.current = {
      active: false,
      draggedId: null,
      startPositions: {},
    };
    dispatch(updateNodesPositions({ positions, history: true }));
    return true;
  };

  return (
    <Group>
      {seats.map((seat) => (
        <SeatItem
          key={seat.id}
          seat={seat}
          isSelected={selectedIds.includes(seat.id)}
          onSelect={(
            id: string,
            evt?: KonvaEventObject<MouseEvent | TouchEvent>,
          ) => {
            const additive =
              evt?.evt?.shiftKey ||
              evt?.evt?.ctrlKey ||
              evt?.evt?.metaKey ||
              isShiftDown;
            if (additive) {
              dispatch(toggleSelectNode(id));
              return;
            }
            dispatch(selectNode(id));
          }}
          onChange={(
            id: string,
            changes: Partial<SeatmapSeatNode>,
            history?: boolean,
          ) => dispatch(updateNode({ id, changes, history }))}
          onDragStart={onNodeDragStart}
          onDragEnd={onNodeDragEnd}
          isShiftDown={isShiftDown}
          onMultiDragStart={(id: string, pos: { x: number; y: number }) =>
            beginMultiDrag(id, pos)
          }
          onMultiDragMove={(id: string, pos: { x: number; y: number }) =>
            updateMultiDrag(id, pos)
          }
          onMultiDragEnd={(id: string, pos: { x: number; y: number }) =>
            endMultiDrag(id, pos)
          }
          selectionCount={selectionCount}
          showGuidePaths={showGuidePaths}
          guidePaths={guidePaths}
          onSnap={onSnap}
          nodes={nodes}
          snapSpacing={snapSpacing}
          categories={categories}
        />
      ))}
    </Group>
  );
}
