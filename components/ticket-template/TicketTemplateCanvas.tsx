"use client";

import * as React from "react";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import type { Transformer as KonvaTransformer } from "konva/lib/shapes/Transformer";
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";

import {
  type TicketTemplateAssetEditorNode,
  type TicketTemplateEditorNode,
  type TicketTemplateFieldEditorNode,
  type TicketTemplateQrEditorNode,
  selectNode,
  updateNode,
} from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

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

function TicketAssetNode({
  node,
  displayScale,
  selected,
  registerRef,
  onSelect,
  onChange,
}: {
  node: TicketTemplateAssetEditorNode;
  displayScale: number;
  selected: boolean;
  registerRef: (nodeId: string, nextNode: unknown | null) => void;
  onSelect: (nodeId: string) => void;
  onChange: (
    nodeId: string,
    changes: Partial<TicketTemplateAssetEditorNode>,
  ) => void;
}) {
  const image = useAssetImage(node.src);

  return (
    <>
      <KonvaImage
        ref={(nextNode) => registerRef(node.id, nextNode)}
        image={image ?? undefined}
        x={node.x * displayScale}
        y={node.y * displayScale}
        width={node.width * displayScale}
        height={node.height * displayScale}
        opacity={node.opacity}
        draggable
        stroke={selected ? "#2563eb" : undefined}
        strokeWidth={selected ? 2 : 0}
        onClick={() => onSelect(node.id)}
        onTap={() => onSelect(node.id)}
        onDragEnd={(event) => {
          onChange(node.id, {
            x: event.target.x() / displayScale,
            y: event.target.y() / displayScale,
          });
        }}
        onTransformEnd={(event) => {
          const target = event.target;
          const nextWidth = Math.max(
            24,
            (target.width() * target.scaleX()) / displayScale,
          );
          const nextHeight = Math.max(
            24,
            (target.height() * target.scaleY()) / displayScale,
          );

          target.scaleX(1);
          target.scaleY(1);

          onChange(node.id, {
            x: target.x() / displayScale,
            y: target.y() / displayScale,
            width: nextWidth,
            height: nextHeight,
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
  selected,
  registerRef,
  onSelect,
  onChange,
}: {
  node: TicketTemplateFieldEditorNode;
  displayScale: number;
  selected: boolean;
  registerRef: (nodeId: string, nextNode: unknown | null) => void;
  onSelect: (nodeId: string) => void;
  onChange: (
    nodeId: string,
    changes: Partial<TicketTemplateFieldEditorNode>,
  ) => void;
}) {
  return (
    <>
      {selected ? (
        <Rect
          x={node.x * displayScale - 8}
          y={node.y * displayScale - 8}
          width={node.width * displayScale + 16}
          height={node.fontSize * displayScale + 16}
          stroke="#2563eb"
          dash={[8, 4]}
          strokeWidth={2}
          listening={false}
        />
      ) : null}
      <Text
        ref={(nextNode) => registerRef(node.id, nextNode)}
        x={node.x * displayScale}
        y={node.y * displayScale}
        width={node.width * displayScale}
        text={node.label}
        fontSize={node.fontSize * displayScale}
        fontFamily={node.fontFamily}
        fontStyle={node.fontWeight >= 700 ? "bold" : "normal"}
        fill={node.fill}
        opacity={node.opacity}
        align={node.align}
        draggable
        onClick={() => onSelect(node.id)}
        onTap={() => onSelect(node.id)}
        onDragEnd={(event) => {
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
  onSelect,
  onChange,
}: {
  node: TicketTemplateQrEditorNode;
  displayScale: number;
  selected: boolean;
  registerRef: (nodeId: string, nextNode: unknown | null) => void;
  onSelect: (nodeId: string) => void;
  onChange: (
    nodeId: string,
    changes: Partial<TicketTemplateQrEditorNode>,
  ) => void;
}) {
  const scaledSize = node.size * displayScale;

  return (
    <>
      <Rect
        ref={(nextNode) => registerRef(node.id, nextNode)}
        x={node.x * displayScale}
        y={node.y * displayScale}
        width={scaledSize}
        height={scaledSize}
        fill="#ffffff"
        stroke={selected ? "#2563eb" : "#111827"}
        strokeWidth={selected ? 3 : 2}
        dash={[10, 6]}
        opacity={node.opacity}
        draggable
        onClick={() => onSelect(node.id)}
        onTap={() => onSelect(node.id)}
        onDragEnd={(event) => {
          onChange(node.id, {
            x: event.target.x() / displayScale,
            y: event.target.y() / displayScale,
          });
        }}
        onTransformEnd={(event) => {
          const target = event.target;
          const nextSize = Math.max(
            48,
            ((target.width() * target.scaleX()) / displayScale +
              (target.height() * target.scaleY()) / displayScale) /
              2,
          );

          target.scaleX(1);
          target.scaleY(1);

          onChange(node.id, {
            x: target.x() / displayScale,
            y: target.y() / displayScale,
            size: nextSize,
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
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const stageRef = React.useRef<KonvaStage | null>(null);
  const transformerRef = React.useRef<KonvaTransformer | null>(null);
  const nodeRefs = React.useRef<Record<string, unknown>>({});
  const [containerSize, setContainerSize] = React.useState({
    width: 1280,
    height: 720,
  });

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

  React.useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    if (!selectedNodeId || selectedNode?.kind === "field") {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const selectedCanvasNode = nodeRefs.current[selectedNodeId];
    if (!selectedCanvasNode) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    transformer.nodes([selectedCanvasNode as never]);
    transformer.getLayer()?.batchDraw();
  }, [selectedNode, selectedNodeId]);

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

  const updateCanvasNode = React.useCallback(
    (id: string, changes: Partial<TicketTemplateEditorNode>) => {
      dispatch(updateNode({ id, changes }));
    },
    [dispatch],
  );

  const registerRef = React.useCallback((id: string, nextNode: unknown | null) => {
    if (nextNode) {
      nodeRefs.current[id] = nextNode;
      return;
    }

    delete nodeRefs.current[id];
  }, []);

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
              onMouseDown={(event) => {
                if (event.target === event.target.getStage()) {
                  dispatch(selectNode(null));
                }
              }}
            >
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={stageDisplayWidth}
                  height={stageDisplayHeight}
                  fill="#ffffff"
                />

                {nodes.map((node) => {
                  if (node.kind === "asset") {
                    return (
                      <TicketAssetNode
                        key={node.id}
                        node={node}
                        displayScale={displayScale}
                        selected={node.id === selectedNodeId}
                        registerRef={registerRef}
                        onSelect={(nodeId) => dispatch(selectNode(nodeId))}
                        onChange={updateCanvasNode}
                      />
                    );
                  }

                  if (node.kind === "field") {
                    return (
                      <TicketFieldNode
                        key={node.id}
                        node={node}
                        displayScale={displayScale}
                        selected={node.id === selectedNodeId}
                        registerRef={registerRef}
                        onSelect={(nodeId) => dispatch(selectNode(nodeId))}
                        onChange={updateCanvasNode}
                      />
                    );
                  }

                  return (
                    <TicketQrNode
                      key={node.id}
                      node={node}
                      displayScale={displayScale}
                      selected={node.id === selectedNodeId}
                      registerRef={registerRef}
                      onSelect={(nodeId) => dispatch(selectNode(nodeId))}
                      onChange={updateCanvasNode}
                    />
                  );
                })}

                <Transformer
                  ref={transformerRef}
                  rotateEnabled={false}
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
