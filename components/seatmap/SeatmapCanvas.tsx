"use strict";
"use client";

import React, { useRef, useEffect } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text,
  Group,
  Circle,
  RegularPolygon,
  Line,
  Transformer,
} from "react-konva";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  setViewport,
  addSeat,
  addShape,
  selectNode,
  deselectAll,
  updateNode,
  updateNodes,
  rotateSelected,
  scaleSelected,
  setViewportSize,
  setSelectedIds,
  copySelected,
  pasteNodesAt,
  deleteSelected,
  undo,
  redo,
} from "@/lib/features/seatmap/seatmapSlice";
import SeatLayer from "@/components/seatmap/SeatLayer";
import SectionLayer from "@/components/seatmap/SectionLayer";
import { getRelativePointerPosition } from "@/lib/seatmap/geometry";

export default function SeatmapCanvas() {
  const dispatch = useAppDispatch();
  const { viewport, mode, drawShape, selectedIds, nodes } = useAppSelector(
    (state) => state.seatmap,
  );
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<any>(null);
  const [isDraggingNode, setIsDraggingNode] = React.useState(false);
  const [isRightPanning, setIsRightPanning] = React.useState(false);
  const [isShiftDown, setIsShiftDown] = React.useState(false);
  const [isCtrlDown, setIsCtrlDown] = React.useState(false);
  const [isAltDown, setIsAltDown] = React.useState(false);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = React.useState(false);
  const rotationStateRef = useRef<{
    active: boolean;
    pivot: { x: number; y: number } | null;
    startPointerAngle: number;
    baseRotation: number;
    lastDelta: number;
    baseNodes: Record<
      string,
      { rotation: number; position: { x: number; y: number } }
    >;
  }>({
    active: false,
    pivot: null,
    startPointerAngle: 0,
    baseRotation: 0,
    lastDelta: 0,
    baseNodes: {},
  });
  const [drawDraft, setDrawDraft] = React.useState<{
    shape: typeof drawShape.shape;
    dash?: number[];
    sides?: number;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const MIN_SCALE = 0.4;
  const MAX_SCALE = 3;
  const ROTATION_SNAP = 15;
  const ROTATION_SNAPS = React.useMemo(() => {
    const snaps: number[] = [];
    for (let angle = 0; angle < 360; angle += ROTATION_SNAP) {
      snaps.push(angle);
    }
    return snaps;
  }, []);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, visible: false });

  // Resize observer to keep stage responsive
  const [dimensions, setDimensions] = React.useState({
    width: 800,
    height: 600,
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    // Initial setup
    updateDimensions();

    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftDown(true);
      if (e.key === "Control") setIsCtrlDown(true);
      if (e.key === "Alt") setIsAltDown(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftDown(false);
      if (e.key === "Control") setIsCtrlDown(false);
      if (e.key === "Alt") setIsAltDown(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    dispatch(setViewportSize(dimensions));
  }, [dimensions, dispatch]);

  useEffect(() => {
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    if (!stage || !transformer) return;
    if (selectedIds.length < 2) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const selectedNodes = selectedIds
      .map((id) => {
        const nodeData = nodes[id];
        if (!nodeData) return null;
        if (nodeData.type === "shape" && nodeData.shape === "line") {
          return null;
        }
        return stage.findOne(`#${id}`);
      })
      .filter(Boolean);

    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, nodes]);

  const commitGroupTransform = (history: boolean) => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const targetNodes = transformer.nodes();
    if (!targetNodes.length) return;

    const changes: Record<string, any> = {};
    targetNodes.forEach((node: any) => {
      const id = node.id();
      if (!id) return;
      changes[id] = {
        position: { x: node.x(), y: node.y() },
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      };
    });

    if (Object.keys(changes).length) {
      dispatch(updateNodes({ changes, history }));
    }
  };

  const normalizeRotation = (value: number) => {
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  };

  const applyGroupRotation = (history: boolean) => {
    const transformer = transformerRef.current;
    const rotationState = rotationStateRef.current;
    const stage = stageRef.current;
    if (!transformer || !rotationState.active || !stage) return false;

    const delta = history
      ? rotationState.lastDelta
      : transformer.rotation() - rotationState.baseRotation;
    rotationState.lastDelta = delta;

    const changes: Record<string, any> = {};

    transformer.nodes().forEach((node: any) => {
      const id = node.id();
      const base = rotationState.baseNodes[id];
      if (!id || !base) return;

      const nextRot = normalizeRotation(base.rotation + delta);

      // Force "in-place": keep base position, only update rotation
      node.x(base.position.x);
      node.y(base.position.y);
      node.rotation(nextRot);

      changes[id] = {
        position: { x: base.position.x, y: base.position.y },
        rotation: nextRot,
      };
    });

    if (Object.keys(changes).length) {
      dispatch(updateNodes({ changes, history }));
    }

    if (history) {
      rotationStateRef.current = {
        active: false,
        pivot: null,
        startPointerAngle: 0,
        baseRotation: 0,
        lastDelta: 0,
        baseNodes: {},
      };
    }

    return true;
  };

  // Center view on load
  useEffect(() => {
    // Only center if we have actual dimensions (default is 800x600)
    // and we haven't touched the viewport yet (scale is 1, position is 0,0) - optional check
    // For this request, we just want to force center on mount when dimensions are ready

    if (dimensions.width !== 800 || dimensions.height !== 600) {
      // Content center approximation
      // X center is 0. Y center is around 200 (sections) to 400 (stage).
      // Let's aim for the section center ~200.
      const contentCenterX = 0;
      const contentCenterY = 200;

      const initialScale = 0.8; // Zoom out a bit to see everything

      const newX = dimensions.width / 2 - contentCenterX * initialScale;
      const newY = dimensions.height / 2 - contentCenterY * initialScale;

      dispatch(
        setViewport({
          position: { x: newX, y: newY },
          scale: initialScale,
        }),
      );
    }
  }, [dimensions, dispatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      // Only if we have a selection
      // We can't easily access Redux state here without a ref or dependency
      // But dispatch works

      // Check for valid keys first to avoid unnecessary dispatches
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "c") {
          e.preventDefault();
          dispatch(copySelected());
          return;
        }
        if (key === "v") {
          e.preventDefault();
          const stage = stageRef.current;
          const pointer = lastPointerPosRef.current;
          let pos = pointer;
          if (!pos && stage) {
            const center = {
              x: dimensions.width / 2,
              y: dimensions.height / 2,
            };
            pos = {
              x: (center.x - viewport.position.x) / viewport.scale,
              y: (center.y - viewport.position.y) / viewport.scale,
            };
          }
          if (pos) {
            dispatch(pasteNodesAt(pos));
          }
          return;
        }
        if (key === "z") {
          e.preventDefault();
          dispatch(undo());
          return;
        }
        if (key === "y") {
          e.preventDefault();
          dispatch(redo());
          return;
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        dispatch(deleteSelected());
        return;
      }

      if (["[", "]", "-", "="].includes(e.key)) {
        const rotateStep = e.shiftKey ? 15 : 5;
        switch (e.key) {
          case "[":
            dispatch(rotateSelected(-rotateStep));
            break;
          case "]":
            dispatch(rotateSelected(rotateStep));
            break;
          case "-":
            dispatch(scaleSelected(0.9));
            break;
          case "=":
            dispatch(scaleSelected(1.1));
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, dimensions, viewport]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    // Trackpad pinch typically sets ctrlKey=true on wheel events.
    const isPinchZoom = e.evt.ctrlKey === true;

    if (isPinchZoom && pointer) {
      const scaleBy = 1.06;
      const nextScale =
        e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      dispatch(setViewport({ position: newPos, scale: newScale }));
      return;
    }

    const newPos = {
      x: viewport.position.x - e.evt.deltaX,
      y: viewport.position.y - e.evt.deltaY,
    };
    dispatch(setViewport({ position: newPos, scale: viewport.scale }));
  };

  const handleDragEnd = (e: any) => {
    const stage = stageRef.current;
    if (!stage || e.target !== stage) return;

    // Update viewport on pan end
    dispatch(
      setViewport({
        position: { x: stage.x(), y: stage.y() },
        scale: viewport.scale,
      }),
    );
  };

  const handleStageClick = (e: any) => {
    if (mode === "draw") return;
    const additive = e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey;
    if (e.target === e.target.getStage()) {
      if (!additive) {
        dispatch(deselectAll());
      }
      return;
    }
    // If clicked on section or something else that isn't a seat, deselect
    // Seat selection is handled in SeatItem
    // Shape selection is handled in ShapeItem
    if (!e.target.hasName("seat-image") && !e.target.hasName("shape-item")) {
      if (!additive) {
        dispatch(deselectAll());
      }
    }
  };

  // HELPERS FOR GROUP ROTATE (ORBIT MODE)

  function getSelectionPivot(stage: any, nodes: any[]) {
    if (!nodes.length) return null;

    // bounding box in STAGE/world coords
    const rects = nodes.map((n) => n.getClientRect({ relativeTo: stage }));
    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxX = Math.max(...rects.map((r) => r.x + r.width));
    const maxY = Math.max(...rects.map((r) => r.y + r.height));

    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  const rad = (deg: number) => (deg * Math.PI) / 180;
  const deg = (rad: number) => (rad * 180) / Math.PI;

  function angleFrom(p: { x: number; y: number }, c: { x: number; y: number }) {
    return deg(Math.atan2(p.y - c.y, p.x - c.x));
  }

  // Keep delta in [-180, 180] to prevent jump at wraparound
  function normalizeDelta(d: number) {
    let x = d % 360;
    if (x > 180) x -= 360;
    if (x < -180) x += 360;
    return x;
  }

  function rotatePoint(
    p: { x: number; y: number },
    c: { x: number; y: number },
    deltaDeg: number,
  ) {
    const r = rad(deltaDeg);
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return {
      x: c.x + dx * cos - dy * sin,
      y: c.y + dx * sin + dy * cos,
    };
  }

  // Use stage transform to get pointer in WORLD coords (works with pan/zoom)
  function getWorldPointer(stage: any) {
    const p = stage.getPointerPosition();
    if (!p) return null;
    const t = stage.getAbsoluteTransform().copy().invert();
    return t.point(p);
  }

  const applyCursorDrivenGroupRotation = (history: boolean) => {
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    const state = rotationStateRef.current;
    if (!stage || !transformer || !state.active || !state.pivot) return false;

    const wp = getWorldPointer(stage);
    if (!wp) return false;

    const currentAngle = angleFrom(wp, state.pivot);
    const delta = normalizeDelta(currentAngle - state.startPointerAngle);

    const changes: Record<string, any> = {};

    transformer.nodes().forEach((node: any) => {
      const id = node.id();
      const base = state.baseNodes[id];
      if (!id || !base) return;

      // ORBIT: rotate position around pivot
      const nextPos = rotatePoint(base.position, state.pivot!, delta);

      // Rotate node by same delta (keeps orientation consistent)
      const nextRot = normalizeRotation(base.rotation + delta);

      node.position(nextPos);
      node.rotation(nextRot);

      changes[id] = {
        position: nextPos,
        rotation: nextRot,
      };
    });

    // Don’t spam history while dragging
    dispatch(updateNodes({ changes, history }));

    if (history) {
      rotationStateRef.current = {
        active: false,
        pivot: null,
        startPointerAngle: 0,
        baseRotation: 0,
        lastDelta: 0,
        baseNodes: {},
      };
    }

    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    stage.setPointersPositions(e);
    const pointerPosition = stage.getPointerPosition();

    if (!pointerPosition) return;

    // Convert to relative stage coordinates
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = transform.point(pointerPosition);

    const type = e.dataTransfer.getData("type");
    const shape = e.dataTransfer.getData("shape");
    const seatType = e.dataTransfer.getData("seatType");

    if (type === "shape") {
      const sides = e.dataTransfer.getData("sides");
      const dashStr = e.dataTransfer.getData("dash");
      let dash = undefined;
      if (dashStr === "[5,5]") dash = [5, 5];

      dispatch(
        addShape({
          x: pos.x,
          y: pos.y,
          shape: shape as any,
          sides: sides ? parseInt(sides) : undefined,
          dash: dash,
        }),
      );
    } else {
      // Default to seat
      dispatch(
        addSeat({
          x: pos.x,
          y: pos.y,
          seatType: seatType === "vip" ? "vip" : "standard",
        }),
      );
    }
  };

  const handleMouseDown = (e: any) => {
    const stage = stageRef.current;
    if (stage) {
      const pos = getRelativePointerPosition(stage);
      if (pos) {
        lastPointerPosRef.current = pos;
      }
    }
    if (
      mode === "select" &&
      e.evt &&
      e.evt.button === 0 &&
      e.target === e.target.getStage()
    ) {
      const pos = getRelativePointerPosition(stage);
      if (!pos) return;
      marqueeStartRef.current = pos;
      setIsMarqueeSelecting(true);
      setMarqueeRect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        visible: true,
      });
      return;
    }
    if (e.evt && e.evt.button === 2) {
      setIsRightPanning(true);
      return;
    }
    if (mode !== "draw") return;
    if (e.evt && e.evt.button !== 0) return;
    if (e.target !== e.target.getStage()) return;
    if (!stage) return;
    const pos = getRelativePointerPosition(stage);
    if (!pos) return;

    setDrawDraft({
      shape: drawShape.shape,
      dash: drawShape.dash,
      sides: drawShape.sides,
      start: pos,
      current: pos,
    });
  };

  const handleMouseMove = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = getRelativePointerPosition(stage);
    if (!pos) return;
    lastPointerPosRef.current = pos;
    if (isMarqueeSelecting && marqueeStartRef.current) {
      const start = marqueeStartRef.current;
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const width = Math.abs(pos.x - start.x);
      const height = Math.abs(pos.y - start.y);
      setMarqueeRect({ x, y, width, height, visible: true });
      return;
    }
    if (drawDraft) {
      setDrawDraft((prev) => (prev ? { ...prev, current: pos } : prev));
    }
  };

  const handleMouseUp = () => {
    if (isMarqueeSelecting) {
      const stage = stageRef.current;
      const start = marqueeStartRef.current;
      if (stage && start) {
        const x = marqueeRect.x;
        const y = marqueeRect.y;
        const width = marqueeRect.width;
        const height = marqueeRect.height;
        const intersectingIds = stage
          .find(".selectable")
          .filter((node: any) => {
            const rect = node.getClientRect({ relativeTo: stage });
            const intersects =
              rect.x < x + width &&
              rect.x + rect.width > x &&
              rect.y < y + height &&
              rect.y + rect.height > y;
            return intersects;
          })
          .map((node: any) => node.id())
          .filter(Boolean);

        const current = new Set(selectedIds);
        if (isAltDown) {
          intersectingIds.forEach((id: string) => current.delete(id));
        } else if (isShiftDown || isCtrlDown) {
          intersectingIds.forEach((id: string) => current.add(id));
        } else {
          current.clear();
          intersectingIds.forEach((id: string) => current.add(id));
        }
        dispatch(setSelectedIds(Array.from(current)));
      }

      marqueeStartRef.current = null;
      setIsMarqueeSelecting(false);
      setMarqueeRect({ x: 0, y: 0, width: 0, height: 0, visible: false });
      return;
    }
    if (isRightPanning) {
      setIsRightPanning(false);
      return;
    }
    if (!drawDraft) return;

    const { start, current } = drawDraft;
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const width = Math.abs(dx);
    const height = Math.abs(dy);
    const minSize = 4;

    if (drawDraft.shape === "line") {
      const length = Math.hypot(dx, dy);
      if (length >= minSize) {
        dispatch(
          addShape({
            x: start.x,
            y: start.y,
            shape: "line",
            dash: drawDraft.dash,
            points: [0, 0, dx, dy],
            strokeWidth: 2,
          }),
        );
      }
      setDrawDraft(null);
      return;
    }

    if (width < minSize || height < minSize) {
      setDrawDraft(null);
      return;
    }

    const centerX = start.x + dx / 2;
    const centerY = start.y + dy / 2;

    if (drawDraft.shape === "rect") {
      dispatch(
        addShape({
          x: centerX,
          y: centerY,
          shape: "rect",
          width,
          height,
        }),
      );
    } else if (drawDraft.shape === "circle") {
      const radius = Math.min(width, height) / 2;
      dispatch(
        addShape({
          x: centerX,
          y: centerY,
          shape: "circle",
          radius,
        }),
      );
    } else if (drawDraft.shape === "polygon") {
      const radius = Math.min(width, height) / 2;
      dispatch(
        addShape({
          x: centerX,
          y: centerY,
          shape: "polygon",
          radius,
          sides: drawDraft.sides ?? 6,
        }),
      );
    }

    setDrawDraft(null);
  };

  const renderDraft = () => {
    if (!drawDraft) return null;

    const { start, current } = drawDraft;
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const width = Math.abs(dx);
    const height = Math.abs(dy);
    const centerX = start.x + dx / 2;
    const centerY = start.y + dy / 2;

    if (drawDraft.shape === "line") {
      return (
        <Line
          points={[start.x, start.y, current.x, current.y]}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={drawDraft.dash}
        />
      );
    }

    if (drawDraft.shape === "rect") {
      return (
        <Rect
          x={centerX}
          y={centerY}
          width={width}
          height={height}
          offsetX={width / 2}
          offsetY={height / 2}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[6, 4]}
          fill="rgba(59, 130, 246, 0.15)"
        />
      );
    }

    if (drawDraft.shape === "circle") {
      const radius = Math.min(width, height) / 2;
      return (
        <Circle
          x={centerX}
          y={centerY}
          radius={radius}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[6, 4]}
          fill="rgba(59, 130, 246, 0.15)"
        />
      );
    }

    if (drawDraft.shape === "polygon") {
      const radius = Math.min(width, height) / 2;
      return (
        <RegularPolygon
          x={centerX}
          y={centerY}
          sides={drawDraft.sides ?? 6}
          radius={radius}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[6, 4]}
          fill="rgba(59, 130, 246, 0.15)"
        />
      );
    }

    return null;
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        draggable={(mode === "pan" || isRightPanning) && !isDraggingNode}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.evt?.preventDefault()}
        ref={stageRef}
        x={viewport.position.x}
        y={viewport.position.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onDragEnd={handleDragEnd}
      >
        <Layer>{/* Grid or Background could go here */}</Layer>

        <Layer listening={false}>
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
            />
          )}
        </Layer>

        <Layer listening={false}>{renderDraft()}</Layer>

        <SectionLayer
          onNodeDragStart={() => setIsDraggingNode(true)}
          onNodeDragEnd={() => setIsDraggingNode(false)}
        />

        <Layer>{/* Stage Label Removed */}</Layer>

        <SeatLayer
          onNodeDragStart={() => setIsDraggingNode(true)}
          onNodeDragEnd={() => setIsDraggingNode(false)}
        />

        <Layer>
          <Transformer
            ref={transformerRef}
            rotateEnabled
            resizeEnabled
            rotationSnaps={isShiftDown ? ROTATION_SNAPS : []}
            rotateAnchorOffset={40}
            onTransformStart={() => {
              const stage = stageRef.current;
              const transformer = transformerRef.current;
              if (!stage || !transformer) return;

              const selected = transformer.nodes();
              if (!selected.length) return;

              const pivot = getSelectionPivot(stage, selected);
              if (!pivot) return;

              const wp = getWorldPointer(stage);
              if (!wp) return;

              const baseNodes: Record<
                string,
                { rotation: number; position: { x: number; y: number } }
              > = {};
              selected.forEach((node: any) => {
                const id = node.id();
                if (!id) return;
                baseNodes[id] = {
                  rotation: node.rotation(),
                  position: { x: node.x(), y: node.y() },
                };
              });

              rotationStateRef.current = {
                active: true,
                pivot,
                startPointerAngle: angleFrom(wp, pivot),
                baseRotation: transformer.rotation(),
                lastDelta: 0,
                baseNodes,
              };
            }}
            onTransform={() => {
              if (isAltDown && applyGroupRotation(false)) return;
              if (applyCursorDrivenGroupRotation(false)) return;
              commitGroupTransform(false);
            }}
            onTransformEnd={() => {
              if (isAltDown && applyGroupRotation(true)) return;
              if (applyCursorDrivenGroupRotation(true)) return;
              commitGroupTransform(true);
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}
