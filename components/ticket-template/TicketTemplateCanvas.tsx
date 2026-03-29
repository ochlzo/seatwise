"use client";

import * as React from "react";
import type { KonvaEventObject, Node as KonvaNode } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import type { Transformer as KonvaTransformer } from "konva/lib/shapes/Transformer";
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";

import {
  copySelectedNodes,
  cutSelectedNodes,
  deleteSelectedNode,
  moveSelectedNodesBy,
  pasteNodesAt,
  redo,
  type TicketTemplateAssetEditorNode,
  type TicketTemplateEditorNode,
  type TicketTemplateFieldEditorNode,
  type TicketTemplateQrEditorNode,
  undo,
  selectNode,
  selectNodes,
  toggleNodeInSelection,
  updateNode,
  updateNodes,
} from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { getTicketTemplateFontOptionByFamily } from "@/lib/tickets/fontCatalog";

function useAssetImage(src: string | null) {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);

  React.useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => setImage(nextImage);
    nextImage.onerror = () => setImage(null);
    nextImage.src = src;
  }, [src]);

  return image;
}

type NodePointerHandler = (
  nodeId: string,
  event: KonvaEventObject<MouseEvent>,
) => void;

type NodeDragHandler = (
  nodeId: string,
  event: KonvaEventObject<DragEvent>,
) => boolean;

function TicketAssetNode({
  node,
  displayScale,
  selected,
  registerRef,
  onPointerDown,
  onSelect,
  onChange,
  onGroupDragStart,
  onGroupDragMove,
  onGroupDragEnd,
}: {
  node: TicketTemplateAssetEditorNode;
  displayScale: number;
  selected: boolean;
  registerRef: (nodeId: string, nextNode: KonvaNode | null) => void;
  onPointerDown: NodePointerHandler;
  onSelect: (nodeId: string) => void;
  onChange: (
    nodeId: string,
    changes: Partial<TicketTemplateAssetEditorNode>,
  ) => void;
  onGroupDragStart: NodeDragHandler;
  onGroupDragMove: NodeDragHandler;
  onGroupDragEnd: NodeDragHandler;
}) {
  const image = useAssetImage(node.src);

  return (
    <>
      <KonvaImage
        id={node.id}
        name="ticket-selectable"
        ref={(nextNode) => registerRef(node.id, nextNode)}
        image={image ?? undefined}
        x={node.x * displayScale}
        y={node.y * displayScale}
        rotation={node.rotation}
        width={node.width * displayScale}
        height={node.height * displayScale}
        opacity={node.opacity}
        draggable
        stroke={selected ? "#2563eb" : undefined}
        strokeWidth={selected ? 2 : 0}
        onMouseDown={(event) => onPointerDown(node.id, event)}
        onTap={() => onSelect(node.id)}
        onDragStart={(event) => {
          onGroupDragStart(node.id, event);
        }}
        onDragMove={(event) => {
          onGroupDragMove(node.id, event);
        }}
        onDragEnd={(event) => {
          const handled = onGroupDragEnd(node.id, event);
          if (handled) {
            return;
          }

          onChange(node.id, {
            x: event.target.x() / displayScale,
            y: event.target.y() / displayScale,
          });
        }}
      />
      {!image ? (
        <>
          <Rect
            x={node.x * displayScale}
            y={node.y * displayScale}
            width={node.width * displayScale}
            height={node.height * displayScale}
            fill="#e5e7eb"
            dash={[12, 6]}
            listening={false}
          />
          <Text
            x={node.x * displayScale + 16}
            y={node.y * displayScale + 16}
            width={Math.max(node.width * displayScale - 32, 0)}
            text={node.name ?? "PNG Asset"}
            fontSize={Math.max(14, 24 * displayScale)}
            fill="#52525b"
            listening={false}
          />
        </>
      ) : null}
    </>
  );
}

function TicketFieldNode({
  node,
  displayScale,
  registerRef,
  onPointerDown,
  onSelect,
  onChange,
  onGroupDragStart,
  onGroupDragMove,
  onGroupDragEnd,
}: {
  node: TicketTemplateFieldEditorNode;
  displayScale: number;
  registerRef: (nodeId: string, nextNode: KonvaNode | null) => void;
  onPointerDown: NodePointerHandler;
  onSelect: (nodeId: string) => void;
  onChange: (
    nodeId: string,
    changes: Partial<TicketTemplateFieldEditorNode>,
  ) => void;
  onGroupDragStart: NodeDragHandler;
  onGroupDragMove: NodeDragHandler;
  onGroupDragEnd: NodeDragHandler;
}) {
  return (
    <>
      <Text
        id={node.id}
        name="ticket-selectable"
        ref={(nextNode) => registerRef(node.id, nextNode)}
        x={node.x * displayScale}
        y={node.y * displayScale}
        rotation={node.rotation}
        width={node.width * displayScale}
        text={node.label}
        fontSize={node.fontSize * displayScale}
        fontFamily={node.fontFamily}
        fontStyle={node.fontWeight >= 700 ? "bold" : "normal"}
        fill={node.fill}
        opacity={node.opacity}
        align={node.align}
        draggable
        onMouseDown={(event) => onPointerDown(node.id, event)}
        onTap={() => onSelect(node.id)}
        onDragStart={(event) => {
          onGroupDragStart(node.id, event);
        }}
        onDragMove={(event) => {
          onGroupDragMove(node.id, event);
        }}
        onDragEnd={(event) => {
          const handled = onGroupDragEnd(node.id, event);
          if (handled) {
            return;
          }

          onChange(node.id, {
            x: event.target.x() / displayScale,
            y: event.target.y() / displayScale,
          });
        }}
      />
    </>
  );
}

function TicketQrNode({
  node,
  displayScale,
  selected,
  registerRef,
  onPointerDown,
  onSelect,
  onChange,
  onGroupDragStart,
  onGroupDragMove,
  onGroupDragEnd,
}: {
  node: TicketTemplateQrEditorNode;
  displayScale: number;
  selected: boolean;
  registerRef: (nodeId: string, nextNode: KonvaNode | null) => void;
  onPointerDown: NodePointerHandler;
  onSelect: (nodeId: string) => void;
  onChange: (
    nodeId: string,
    changes: Partial<TicketTemplateQrEditorNode>,
  ) => void;
  onGroupDragStart: NodeDragHandler;
  onGroupDragMove: NodeDragHandler;
  onGroupDragEnd: NodeDragHandler;
}) {
  const scaledSize = node.size * displayScale;

  return (
    <>
      <Rect
        id={node.id}
        name="ticket-selectable"
        ref={(nextNode) => registerRef(node.id, nextNode)}
        x={node.x * displayScale}
        y={node.y * displayScale}
        rotation={node.rotation}
        width={scaledSize}
        height={scaledSize}
        fill="#ffffff"
        stroke={selected ? "#2563eb" : "#111827"}
        strokeWidth={selected ? 3 : 2}
        dash={[10, 6]}
        opacity={node.opacity}
        draggable
        onMouseDown={(event) => onPointerDown(node.id, event)}
        onTap={() => onSelect(node.id)}
        onDragStart={(event) => {
          onGroupDragStart(node.id, event);
        }}
        onDragMove={(event) => {
          onGroupDragMove(node.id, event);
        }}
        onDragEnd={(event) => {
          const handled = onGroupDragEnd(node.id, event);
          if (handled) {
            return;
          }

          onChange(node.id, {
            x: event.target.x() / displayScale,
            y: event.target.y() / displayScale,
          });
        }}
      />
      <Text
        x={node.x * displayScale}
        y={node.y * displayScale + scaledSize / 2 - 16}
        width={scaledSize}
        align="center"
        text="QR"
        fontSize={Math.max(18, scaledSize / 4)}
        fontStyle="bold"
        fill="#111827"
        listening={false}
      />
    </>
  );
}

export function TicketTemplateCanvas() {
  const dispatch = useAppDispatch();
  const canvas = useAppSelector((state) => state.ticketTemplate.canvas);
  const nodes = useAppSelector((state) => state.ticketTemplate.nodes);
  const selectedNodeId = useAppSelector(
    (state) => state.ticketTemplate.selectedNodeId,
  );
  const selectedNodeIds = useAppSelector(
    (state) => state.ticketTemplate.selectedNodeIds,
  );

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const stageRef = React.useRef<KonvaStage | null>(null);
  const transformerRef = React.useRef<KonvaTransformer | null>(null);
  const nodeRefs = React.useRef<Record<string, KonvaNode>>({});
  const selectedNodeIdsRef = React.useRef<string[]>(selectedNodeIds);
  const nodeMapRef = React.useRef<Map<string, TicketTemplateEditorNode>>(new Map());

  const [containerSize, setContainerSize] = React.useState({
    width: 1280,
    height: 720,
  });
  const [isShiftDown, setIsShiftDown] = React.useState(false);
  const [isAltDown, setIsAltDown] = React.useState(false);
  const marqueeStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const marqueeInitialSelectionRef = React.useRef<string[]>([]);
  const lastPointerPositionRef = React.useRef<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = React.useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  const groupDragRef = React.useRef<{
    active: boolean;
    anchorId: string | null;
    selectedIds: string[];
    startPositions: Record<string, { x: number; y: number }>;
  }>({
    active: false,
    anchorId: null,
    selectedIds: [],
    startPositions: {},
  });

  React.useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  React.useEffect(() => {
    nodeMapRef.current = new Map(nodes.map((node) => [node.id, node]));
  }, [nodes]);

  React.useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) {
      return;
    }

    const updateSize = () => {
      setContainerSize({
        width: currentContainer.clientWidth,
        height: currentContainer.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(currentContainer);

    return () => observer.disconnect();
  }, []);

  const displayScale = React.useMemo(() => {
    const widthScale = Math.max((containerSize.width - 64) / canvas.width, 0.2);
    const heightScale = Math.max((containerSize.height - 64) / canvas.height, 0.2);

    return Math.min(widthScale, heightScale, 1);
  }, [canvas.height, canvas.width, containerSize.height, containerSize.width]);

  const stageDisplayWidth = canvas.width * displayScale;
  const stageDisplayHeight = canvas.height * displayScale;

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const fieldFontFamilies = React.useMemo(
    () =>
      new Set(
        nodes
          .filter(
            (node): node is TicketTemplateFieldEditorNode => node.kind === "field",
          )
          .map((node) => node.fontFamily?.trim())
          .filter((family): family is string => Boolean(family)),
      ),
    [nodes],
  );

  const rotationSnaps = React.useMemo(() => {
    const snaps: number[] = [];
    for (let angle = 0; angle < 360; angle += 15) {
      snaps.push(angle);
    }
    return snaps;
  }, []);

  React.useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    if (!selectedNodeIds.length) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const selectedCanvasNodes = selectedNodeIds
      .map((id) => nodeRefs.current[id])
      .filter(Boolean);

    transformer.nodes(selectedCanvasNodes as KonvaNode[]);
    transformer.getLayer()?.batchDraw();
  }, [selectedNodeIds]);

  React.useEffect(() => {
    fieldFontFamilies.forEach((family) => {
      const option = getTicketTemplateFontOptionByFamily(family);
      if (!option?.cssUrl) {
        return;
      }

      const safeFamily = family.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const linkId = `ticket-template-font-${safeFamily}`;
      if (document.getElementById(linkId)) {
        return;
      }

      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = option.cssUrl;
      document.head.appendChild(link);
    });
  }, [fieldFontFamilies]);

  React.useEffect(() => {
    const handleExport = (event: Event) => {
      const detail = (event as CustomEvent<{ fileName?: string }>).detail;
      const fileName = detail?.fileName ?? "ticket-template.png";
      const dataUrl = stageRef.current?.toDataURL({
        pixelRatio: 2,
        mimeType: "image/png",
      });

      if (!dataUrl) {
        return;
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    window.addEventListener(
      "ticket-template-export-png",
      handleExport as EventListener,
    );

    return () => {
      window.removeEventListener(
        "ticket-template-export-png",
        handleExport as EventListener,
      );
    };
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setIsShiftDown(true);
      }
      if (event.key === "Alt") {
        setIsAltDown(true);
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();

        if (key === "c") {
          event.preventDefault();
          dispatch(copySelectedNodes());
          return;
        }

        if (key === "x") {
          event.preventDefault();
          dispatch(cutSelectedNodes());
          return;
        }

        if (key === "v") {
          event.preventDefault();

          const pointer = lastPointerPositionRef.current;
          const position = pointer
            ? {
                x: pointer.x / displayScale,
                y: pointer.y / displayScale,
              }
            : {
                x: canvas.width / 2,
                y: canvas.height / 2,
              };

          dispatch(pasteNodesAt(position));
          return;
        }

        if (key === "z") {
          event.preventDefault();
          dispatch(undo());
          return;
        }

        if (key === "y") {
          event.preventDefault();
          dispatch(redo());
          return;
        }
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        dispatch(deleteSelectedNode());
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();

        const step = 10;
        let dx = 0;
        let dy = 0;

        if (event.key === "ArrowUp") {
          dy = -step;
        } else if (event.key === "ArrowDown") {
          dy = step;
        } else if (event.key === "ArrowLeft") {
          dx = -step;
        } else if (event.key === "ArrowRight") {
          dx = step;
        }

        dispatch(moveSelectedNodesBy({ dx, dy }));
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setIsShiftDown(false);
      }
      if (event.key === "Alt") {
        setIsAltDown(false);
      }
    };

    const handleBlur = () => {
      setIsShiftDown(false);
      setIsAltDown(false);
      marqueeStartRef.current = null;
      setMarqueeRect((current) => ({ ...current, visible: false }));
      groupDragRef.current = {
        active: false,
        anchorId: null,
        selectedIds: [],
        startPositions: {},
      };
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [canvas.height, canvas.width, dispatch, displayScale]);

  const updateCanvasNode = React.useCallback(
    (id: string, changes: Partial<TicketTemplateEditorNode>) => {
      dispatch(updateNode({ id, changes }));
    },
    [dispatch],
  );

  const registerRef = React.useCallback((id: string, nextNode: KonvaNode | null) => {
    if (nextNode) {
      nodeRefs.current[id] = nextNode;
      return;
    }

    delete nodeRefs.current[id];
  }, []);

  const handleNodePointerDown = React.useCallback<NodePointerHandler>(
    (nodeId, event) => {
      if (event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey) {
        dispatch(toggleNodeInSelection(nodeId));
        return;
      }

      const currentSelection = selectedNodeIdsRef.current;
      const isAlreadySelected = currentSelection.includes(nodeId);
      if (isAlreadySelected) {
        // Preserve grouped selection so dragging any selected node moves the group.
        return;
      }

      dispatch(selectNode(nodeId));
    },
    [dispatch],
  );

  const handleNodeTapSelect = React.useCallback(
    (nodeId: string) => {
      dispatch(selectNode(nodeId));
    },
    [dispatch],
  );

  const handleGroupDragStart = React.useCallback<NodeDragHandler>((nodeId) => {
    const selectedIds = selectedNodeIdsRef.current;
    if (!selectedIds.includes(nodeId) || selectedIds.length < 2) {
      return false;
    }

    const startPositions: Record<string, { x: number; y: number }> = {};
    selectedIds.forEach((selectedId) => {
      const ref = nodeRefs.current[selectedId];
      if (!ref) {
        return;
      }

      startPositions[selectedId] = {
        x: ref.x(),
        y: ref.y(),
      };
    });

    if (!startPositions[nodeId]) {
      return false;
    }

    groupDragRef.current = {
      active: true,
      anchorId: nodeId,
      selectedIds,
      startPositions,
    };

    return true;
  }, []);

  const handleGroupDragMove = React.useCallback<NodeDragHandler>((nodeId, event) => {
    const dragState = groupDragRef.current;
    if (!dragState.active || dragState.anchorId !== nodeId) {
      return false;
    }

    const anchorStart = dragState.startPositions[nodeId];
    if (!anchorStart) {
      return false;
    }

    const dx = event.target.x() - anchorStart.x;
    const dy = event.target.y() - anchorStart.y;

    dragState.selectedIds.forEach((selectedId) => {
      if (selectedId === nodeId) {
        return;
      }

      const ref = nodeRefs.current[selectedId];
      const start = dragState.startPositions[selectedId];
      if (!ref || !start) {
        return;
      }

      ref.x(start.x + dx);
      ref.y(start.y + dy);
    });

    event.target.getLayer()?.batchDraw();
    return true;
  }, []);

  const handleGroupDragEnd = React.useCallback<NodeDragHandler>(
    (nodeId) => {
      const dragState = groupDragRef.current;
      if (!dragState.active || dragState.anchorId !== nodeId) {
        return false;
      }

      const changes: Array<{ id: string; changes: Partial<TicketTemplateEditorNode> }> =
        [];

      dragState.selectedIds.forEach((selectedId) => {
        const ref = nodeRefs.current[selectedId];
        if (!ref) {
          return;
        }

        changes.push({
          id: selectedId,
          changes: {
            x: ref.x() / displayScale,
            y: ref.y() / displayScale,
          },
        });
      });

      groupDragRef.current = {
        active: false,
        anchorId: null,
        selectedIds: [],
        startPositions: {},
      };

      if (changes.length > 0) {
        dispatch(updateNodes({ changes }));
      }

      return true;
    },
    [dispatch, displayScale],
  );

  const handleStageMouseDown = React.useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }

      const pointerPosition = stage.getPointerPosition();
      if (pointerPosition) {
        lastPointerPositionRef.current = pointerPosition;
      }

      if (event.target !== event.target.getStage()) {
        return;
      }

      if (event.evt.button !== 0) {
        return;
      }

      if (event.evt.shiftKey && pointerPosition) {
        marqueeStartRef.current = pointerPosition;
        marqueeInitialSelectionRef.current = [...selectedNodeIdsRef.current];
        setMarqueeRect({
          x: pointerPosition.x,
          y: pointerPosition.y,
          width: 0,
          height: 0,
          visible: true,
        });
        return;
      }

      dispatch(selectNode(null));
    },
    [dispatch],
  );

  const handleStageMouseMove = React.useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) {
      return;
    }

    lastPointerPositionRef.current = pointerPosition;

    const marqueeStart = marqueeStartRef.current;
    if (!marqueeStart) {
      return;
    }

    setMarqueeRect({
      x: Math.min(marqueeStart.x, pointerPosition.x),
      y: Math.min(marqueeStart.y, pointerPosition.y),
      width: Math.abs(pointerPosition.x - marqueeStart.x),
      height: Math.abs(pointerPosition.y - marqueeStart.y),
      visible: true,
    });
  }, []);

  const finishMarqueeSelection = React.useCallback(() => {
    const stage = stageRef.current;
    const marqueeStart = marqueeStartRef.current;

    if (!stage || !marqueeStart) {
      marqueeStartRef.current = null;
      setMarqueeRect({ x: 0, y: 0, width: 0, height: 0, visible: false });
      return;
    }

    const { x, y, width, height } = marqueeRect;
    const hasArea = width >= 2 && height >= 2;

    if (hasArea) {
      const intersectingIds = stage
        .find(".ticket-selectable")
        .filter((node) => {
          const rect = node.getClientRect({ relativeTo: stage });
          return (
            rect.x < x + width &&
            rect.x + rect.width > x &&
            rect.y < y + height &&
            rect.y + rect.height > y
          );
        })
        .map((node) => node.id())
        .filter(Boolean);

      const mergedSelection = Array.from(
        new Set([...marqueeInitialSelectionRef.current, ...intersectingIds]),
      );
      dispatch(selectNodes(mergedSelection));
    }

    marqueeStartRef.current = null;
    setMarqueeRect({ x: 0, y: 0, width: 0, height: 0, visible: false });
  }, [dispatch, marqueeRect]);

  const handleTransformerTransformEnd = React.useCallback(() => {
    const activeSelectionIds = selectedNodeIdsRef.current;
    if (!activeSelectionIds.length) {
      return;
    }

    const changes: Array<{ id: string; changes: Partial<TicketTemplateEditorNode> }> = [];

    activeSelectionIds.forEach((id) => {
      const ref = nodeRefs.current[id];
      const editorNode = nodeMapRef.current.get(id);
      if (!ref || !editorNode) {
        return;
      }

      const baseChanges: Partial<TicketTemplateEditorNode> = {
        x: ref.x() / displayScale,
        y: ref.y() / displayScale,
        rotation: ref.rotation(),
      };

      if (editorNode.kind === "asset") {
        const nextWidth = Math.max(
          24,
          (ref.width() * ref.scaleX()) / displayScale,
        );
        const nextHeight = Math.max(
          24,
          (ref.height() * ref.scaleY()) / displayScale,
        );

        ref.scaleX(1);
        ref.scaleY(1);

        changes.push({
          id,
          changes: {
            ...baseChanges,
            width: nextWidth,
            height: nextHeight,
          },
        });
        return;
      }

      if (editorNode.kind === "field") {
        const nextWidth = Math.max(
          80,
          (ref.width() * ref.scaleX()) / displayScale,
        );

        ref.scaleX(1);
        ref.scaleY(1);

        changes.push({
          id,
          changes: {
            ...baseChanges,
            width: nextWidth,
          },
        });
        return;
      }

      const nextSize = Math.max(
        48,
        ((ref.width() * ref.scaleX()) / displayScale +
          (ref.height() * ref.scaleY()) / displayScale) /
          2,
      );

      ref.scaleX(1);
      ref.scaleY(1);

      changes.push({
        id,
        changes: {
          ...baseChanges,
          size: nextSize,
        },
      });
    });

    if (changes.length > 0) {
      dispatch(updateNodes({ changes }));
    }
  }, [dispatch, displayScale]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-zinc-100 p-6 dark:bg-zinc-950">
        <div
          className="mx-auto flex min-h-full items-center justify-center"
          style={{ minWidth: stageDisplayWidth + 32 }}
        >
          <div
            className="rounded-[28px] border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] dark:border-zinc-700"
            style={{
              width: stageDisplayWidth,
              height: stageDisplayHeight,
            }}
          >
            <Stage
              ref={stageRef}
              width={stageDisplayWidth}
              height={stageDisplayHeight}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={finishMarqueeSelection}
              onMouseLeave={finishMarqueeSelection}
            >
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={stageDisplayWidth}
                  height={stageDisplayHeight}
                  fill="#ffffff"
                  listening={false}
                />

                {marqueeRect.visible ? (
                  <Rect
                    x={marqueeRect.x}
                    y={marqueeRect.y}
                    width={marqueeRect.width}
                    height={marqueeRect.height}
                    stroke="#2563eb"
                    strokeWidth={1}
                    dash={[5, 5]}
                    fill="rgba(37,99,235,0.12)"
                    listening={false}
                  />
                ) : null}

                {nodes.map((node) => {
                  const isSelected = selectedNodeIds.includes(node.id);

                  if (node.kind === "asset") {
                    return (
                      <TicketAssetNode
                        key={node.id}
                        node={node}
                        displayScale={displayScale}
                        selected={isSelected}
                        registerRef={registerRef}
                        onPointerDown={handleNodePointerDown}
                        onSelect={handleNodeTapSelect}
                        onChange={updateCanvasNode}
                        onGroupDragStart={handleGroupDragStart}
                        onGroupDragMove={handleGroupDragMove}
                        onGroupDragEnd={handleGroupDragEnd}
                      />
                    );
                  }

                  if (node.kind === "field") {
                    return (
                      <TicketFieldNode
                        key={node.id}
                        node={node}
                        displayScale={displayScale}
                        registerRef={registerRef}
                        onPointerDown={handleNodePointerDown}
                        onSelect={handleNodeTapSelect}
                        onChange={updateCanvasNode}
                        onGroupDragStart={handleGroupDragStart}
                        onGroupDragMove={handleGroupDragMove}
                        onGroupDragEnd={handleGroupDragEnd}
                      />
                    );
                  }

                  return (
                    <TicketQrNode
                      key={node.id}
                      node={node}
                      displayScale={displayScale}
                      selected={isSelected}
                      registerRef={registerRef}
                      onPointerDown={handleNodePointerDown}
                      onSelect={handleNodeTapSelect}
                      onChange={updateCanvasNode}
                      onGroupDragStart={handleGroupDragStart}
                      onGroupDragMove={handleGroupDragMove}
                      onGroupDragEnd={handleGroupDragEnd}
                    />
                  );
                })}

                <Transformer
                  ref={transformerRef}
                  rotateEnabled={selectedNodeIds.length > 0}
                  resizeEnabled={
                    selectedNodeIds.length === 1 && selectedNode?.kind !== "field"
                  }
                  enabledAnchors={
                    selectedNodeIds.length === 1 && selectedNode?.kind === "field"
                      ? []
                      : undefined
                  }
                  rotationSnaps={isShiftDown || isAltDown ? rotationSnaps : []}
                  rotateAnchorOffset={24}
                  onTransformEnd={handleTransformerTransformEnd}
                  boundBoxFunc={(_, nextBox) => ({
                    ...nextBox,
                    width: Math.max(24 * displayScale, nextBox.width),
                    height: Math.max(24 * displayScale, nextBox.height),
                  })}
                />
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
    </div>
  );
}
