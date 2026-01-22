"use client";

import React from "react";
import { Circle, Group, Line } from "react-konva";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  selectNode,
  toggleSelectNode,
  updateNode,
  updateNodesPositions,
} from "@/lib/features/seatmap/seatmapSlice";
import { GuidePathNode, SeatmapSeatNode } from "@/lib/seatmap/types";

type GuidePathLayerProps = {
  stageRef?: React.RefObject<any>;
};

export default function GuidePathLayer({ stageRef }: GuidePathLayerProps) {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((state) => state.seatmap.nodes);
  const selectedIds = useAppSelector((state) => state.seatmap.selectedIds);
  const showGuidePaths = useAppSelector((state) => state.seatmap.showGuidePaths);
  const dragStateRef = React.useRef<Record<string, { x: number; y: number }>>(
    {},
  );

  if (!showGuidePaths) return null;

  const guides = Object.values(nodes).filter(
    (node): node is GuidePathNode =>
      node.type === "helper" && node.helperType === "guidePath",
  );

  if (!guides.length) return null;

  const seatNodes = Object.values(nodes).filter(
    (node): node is SeatmapSeatNode => node.type === "seat",
  );

  const moveLatchedSeats = (
    guideId: string,
    dx: number,
    dy: number,
    history: boolean,
  ) => {
    const positions: Record<string, { x: number; y: number }> = {};
    seatNodes.forEach((seat) => {
      if (seat.snapGuideId !== guideId) return;
      positions[seat.id] = {
        x: seat.position.x + dx,
        y: seat.position.y + dy,
      };
    });
    if (Object.keys(positions).length) {
      dispatch(updateNodesPositions({ positions, history }));
      return true;
    }
    return false;
  };

  const handleGuideDragMove = (guide: GuidePathNode, target: any) => {
    const last = dragStateRef.current[guide.id];
    if (!last) return;
    const dx = target.x() - last.x;
    const dy = target.y() - last.y;
    if (!dx && !dy) return;
    const nextPoints = guide.points.map((value, index) =>
      index % 2 === 0 ? value + dx : value + dy,
    );
    dispatch(updateNode({ id: guide.id, changes: { points: nextPoints }, history: false }));
    moveLatchedSeats(guide.id, dx, dy, false);
    dragStateRef.current[guide.id] = { x: target.x(), y: target.y() };
    if (target) {
      target.position({ x: 0, y: 0 });
    }
    if (stageRef?.current) {
      stageRef.current.batchDraw();
    }
  };

  const handleGuideDragEnd = (guide: GuidePathNode, target: any) => {
    if (target) {
      target.position({ x: 0, y: 0 });
    }
    const positions: Record<string, { x: number; y: number }> = {};
    seatNodes.forEach((seat) => {
      if (seat.snapGuideId !== guide.id) return;
      positions[seat.id] = { x: seat.position.x, y: seat.position.y };
    });
    if (Object.keys(positions).length) {
      dispatch(updateNodesPositions({ positions, history: true }));
    }
    dispatch(updateNode({ id: guide.id, changes: { points: guide.points }, history: true }));
    delete dragStateRef.current[guide.id];
  };

  const updateEndpoint = (
    guide: GuidePathNode,
    index: number,
    next: { x: number; y: number },
    history: boolean,
    shiftKey?: boolean,
  ) => {
    let snapped = next;
    if (shiftKey) {
      const otherIndex = index === 0 ? guide.points.length - 2 : 0;
      const other = {
        x: guide.points[otherIndex],
        y: guide.points[otherIndex + 1],
      };
      const dx = next.x - other.x;
      const dy = next.y - other.y;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const step = Math.PI / 4;
        const angle = Math.atan2(dy, dx);
        const snappedAngle = Math.round(angle / step) * step;
        snapped = {
          x: other.x + Math.cos(snappedAngle) * length,
          y: other.y + Math.sin(snappedAngle) * length,
        };
      }
    }
    const points = [...guide.points];
    points[index] = snapped.x;
    points[index + 1] = snapped.y;
    dispatch(updateNode({ id: guide.id, changes: { points }, history }));
  };

  return (
    <Group>
      {guides.map((guide) => {
        const isSelected = selectedIds.includes(guide.id);
        const selectionCount = selectedIds.length;
        const points = guide.points;
        const start = { x: points[0], y: points[1] };
        const endIndex = Math.max(2, points.length - 2);
        const end = { x: points[endIndex], y: points[endIndex + 1] };
        return (
          <Group
            key={guide.id}
            onClick={(e) => {
              e.cancelBubble = true;
              const additive = e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey;
              if (additive) {
                dispatch(toggleSelectNode(guide.id));
                return;
              }
              dispatch(selectNode(guide.id));
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              const additive = e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey;
              if (additive) {
                dispatch(toggleSelectNode(guide.id));
                return;
              }
              dispatch(selectNode(guide.id));
            }}
          >
            <Line
              id={guide.id}
              points={guide.points}
              stroke={guide.stroke ?? "#9ca3af"}
              strokeWidth={guide.strokeWidth ?? 2}
              dash={guide.dash ?? [6, 4]}
              lineCap="round"
              lineJoin="round"
              name="guide-path selectable"
              draggable={isSelected}
              listening
              strokeScaleEnabled={false}
              onDragStart={(e) => {
                dragStateRef.current[guide.id] = { x: e.target.x(), y: e.target.y() };
              }}
              onDragMove={(e) =>
                handleGuideDragMove(guide, e.target)
              }
              onDragEnd={(e) => handleGuideDragEnd(guide, e.target)}
            />
            {isSelected && selectionCount === 1 && (
              <>
                <Circle
                  x={start.x}
                  y={start.y}
                  radius={6}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth={2}
                  draggable
                  name="guide-path-handle"
                  onDragMove={(e) =>
                    updateEndpoint(
                      guide,
                      0,
                      { x: e.target.x(), y: e.target.y() },
                      false,
                      e.evt?.shiftKey,
                    )
                  }
                  onDragEnd={(e) =>
                    updateEndpoint(
                      guide,
                      0,
                      { x: e.target.x(), y: e.target.y() },
                      true,
                      e.evt?.shiftKey,
                    )
                  }
                />
                <Circle
                  x={end.x}
                  y={end.y}
                  radius={6}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth={2}
                  draggable
                  name="guide-path-handle"
                  onDragMove={(e) =>
                    updateEndpoint(
                      guide,
                      endIndex,
                      { x: e.target.x(), y: e.target.y() },
                      false,
                      e.evt?.shiftKey,
                    )
                  }
                  onDragEnd={(e) =>
                    updateEndpoint(
                      guide,
                      endIndex,
                      { x: e.target.x(), y: e.target.y() },
                      true,
                      e.evt?.shiftKey,
                    )
                  }
                />
              </>
            )}
          </Group>
        );
      })}
    </Group>
  );
}
