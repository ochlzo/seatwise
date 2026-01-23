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
import { closestPointOnPolyline } from "@/lib/seatmap/geometry";
import { GuidePathNode, SeatmapSeatNode } from "@/lib/seatmap/types";

type GuidePathLayerProps = {
  stageRef?: React.RefObject<any>;
};

export default function GuidePathLayer({ stageRef }: GuidePathLayerProps) {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((state) => state.seatmap.nodes);
  const selectedIds = useAppSelector((state) => state.seatmap.selectedIds);
  const showGuidePaths = useAppSelector(
    (state) => state.seatmap.showGuidePaths,
  );
  const dragStateRef = React.useRef<Record<string, { x: number; y: number }>>(
    {},
  );
  const endpointOffsetsRef = React.useRef<
    Record<string, Record<string, { t: number; distance: number }>>
  >({});

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

  const captureEndpointOffsets = (guide: GuidePathNode) => {
    const offsets: Record<string, { t: number; distance: number }> = {};
    if (guide.points.length < 4) return offsets;
    const [ax, ay, bx, by] = guide.points;
    const vx = bx - ax;
    const vy = by - ay;
    const lenSq = vx * vx + vy * vy;
    if (!lenSq) return offsets;
    const len = Math.sqrt(lenSq);
    const nx = -vy / len;
    const ny = vx / len;

    seatNodes.forEach((seat) => {
      if (seat.snapGuideId !== guide.id) return;
      const t = Math.max(
        0,
        Math.min(1, ((seat.position.x - ax) * vx + (seat.position.y - ay) * vy) / lenSq),
      );
      const closest = closestPointOnPolyline(
        seat.position.x,
        seat.position.y,
        guide.points,
      );
      if (!Number.isFinite(closest.distance)) return;
      const distance =
        (seat.position.x - closest.point.x) * nx +
        (seat.position.y - closest.point.y) * ny;
      offsets[seat.id] = { t, distance };
    });

    return offsets;
  };

  const applyEndpointOffsets = (
    guideId: string,
    points: number[],
    history: boolean,
  ) => {
    const offsets = endpointOffsetsRef.current[guideId];
    if (!offsets || !Object.keys(offsets).length) return;
    if (points.length < 4) return;
    const [ax, ay, bx, by] = points;
    const vx = bx - ax;
    const vy = by - ay;
    const len = Math.hypot(vx, vy);
    if (!len) return;
    const nx = -vy / len;
    const ny = vx / len;
    const positions: Record<string, { x: number; y: number }> = {};
    Object.entries(offsets).forEach(([seatId, data]) => {
      const t = Math.max(0, Math.min(1, data.t));
      const px = ax + vx * t;
      const py = ay + vy * t;
      positions[seatId] = {
        x: px + nx * data.distance,
        y: py + ny * data.distance,
      };
    });
    if (Object.keys(positions).length) {
      dispatch(updateNodesPositions({ positions, history }));
    }
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
    dispatch(
      updateNode({
        id: guide.id,
        changes: { points: nextPoints },
        history: false,
      }),
    );
    moveLatchedSeats(guide.id, dx, dy, false);
    dragStateRef.current[guide.id] = { x: target.x(), y: target.y() };
    if (target) {
      target.position({ x: 0, y: 0 });
    }
    if (stageRef?.current) {
      stageRef.current.batchDraw();
    }
  };

  const handleGuideDragEnd = (guideId: string, target: any) => {
    if (target) target.position({ x: 0, y: 0 });

    const latest = Object.values(nodes).find(
      (n): n is GuidePathNode =>
        n.id === guideId && n.type === "helper" && n.helperType === "guidePath",
    );

    if (!latest) return;

    const positions: Record<string, { x: number; y: number }> = {};
    seatNodes.forEach((seat) => {
      if (seat.snapGuideId !== guideId) return;
      positions[seat.id] = { x: seat.position.x, y: seat.position.y };
    });
    if (Object.keys(positions).length) {
      dispatch(updateNodesPositions({ positions, history: true }));
    }

    dispatch(
      updateNode({
        id: guideId,
        changes: { points: latest.points },
        history: true,
      }),
    );

    delete dragStateRef.current[guideId];
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
      const otherIndex =
        index === 0
          ? 2
          : index >= guide.points.length - 2
            ? index - 2
            : index - 2;

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
    applyEndpointOffsets(guide.id, points, history);
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
            id={guide.id}
            name="guide-path selectable"
            onClick={(e) => {
              e.cancelBubble = true;
              const additive =
                e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey;
              if (additive) {
                dispatch(toggleSelectNode(guide.id));
                return;
              }
              dispatch(selectNode(guide.id));
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              const additive =
                e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey;
              if (additive) {
                dispatch(toggleSelectNode(guide.id));
                return;
              }
              dispatch(selectNode(guide.id));
            }}
          >
            <Line
              points={guide.points}
              stroke="rgba(0,0,0,0)"
              strokeWidth={14}
              lineCap="round"
              lineJoin="round"
              listening={false}
              strokeScaleEnabled={false}
            />
            <Line
              points={guide.points}
              stroke={guide.stroke ?? "#9ca3af"}
              strokeWidth={guide.strokeWidth ?? 2}
              dash={guide.dash ?? [6, 4]}
              lineCap="round"
              lineJoin="round"
              name="guide-path"
              draggable={isSelected}
              listening
              strokeScaleEnabled={false}
              onClick={(e) => {
                e.cancelBubble = true;
                const additive =
                  e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey;
                if (additive) {
                  dispatch(toggleSelectNode(guide.id));
                  return;
                }
                dispatch(selectNode(guide.id));
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                const additive =
                  e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey;
                if (additive) {
                  dispatch(toggleSelectNode(guide.id));
                  return;
                }
                dispatch(selectNode(guide.id));
              }}
              onDragStart={(e) => {
                dragStateRef.current[guide.id] = {
                  x: e.target.x(),
                  y: e.target.y(),
                };
              }}
              onDragMove={(e) => handleGuideDragMove(guide, e.target)}
              onDragEnd={(e) => handleGuideDragEnd(guide.id, e.target)}
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
                  onDragStart={() => {
                    endpointOffsetsRef.current[guide.id] =
                      captureEndpointOffsets(guide);
                  }}
                  onDragMove={(e) =>
                    updateEndpoint(
                      guide,
                      0,
                      { x: e.target.x(), y: e.target.y() },
                      false,
                      e.evt?.shiftKey,
                    )
                  }
                  onDragEnd={(e) => {
                    const next = { x: e.target.x(), y: e.target.y() };
                    e.target.position({ x: 0, y: 0 });
                    updateEndpoint(guide, 0, next, true, e.evt?.shiftKey);
                    delete endpointOffsetsRef.current[guide.id];
                  }}
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
                  onDragStart={() => {
                    endpointOffsetsRef.current[guide.id] =
                      captureEndpointOffsets(guide);
                  }}
                  onDragMove={(e) =>
                    updateEndpoint(
                      guide,
                      endIndex,
                      { x: e.target.x(), y: e.target.y() },
                      false,
                      e.evt?.shiftKey,
                    )
                  }
                  onDragEnd={(e) => {
                    const next = { x: e.target.x(), y: e.target.y() };
                    e.target.position({ x: 0, y: 0 });
                    updateEndpoint(guide, endIndex, next, true, e.evt?.shiftKey);
                    delete endpointOffsetsRef.current[guide.id];
                  }}
                />
              </>
            )}
          </Group>
        );
      })}
    </Group>
  );
}
