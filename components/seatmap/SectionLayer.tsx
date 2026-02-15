"use client";

import React from "react";
import { Rect, Circle, RegularPolygon, Line, Group, Transformer, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Node as KonvaNode } from "konva/lib/Node";
import type { Text as KonvaText } from "konva/lib/shapes/Text";
import type { Transformer as KonvaTransformer } from "konva/lib/shapes/Transformer";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
    selectNode,
    toggleSelectNode,
    updateNode,
    updateNodesPositions,
} from "@/lib/features/seatmap/seatmapSlice";
import {
    getNodeBoundingBox,
    getNodesBoundingBox,
    getSnapResults
} from "@/lib/seatmap/geometry";
import { SeatmapNode, SeatmapShapeNode } from "@/lib/seatmap/types";

const ROTATION_SNAP = 15;
const MIN_SIZE = 10;
const MAX_SIZE = 800;
const MIN_LINE_LENGTH = 6;
const DEFAULT_TEXT = "Text";
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_FONT_FAMILY = "Inter";
const DEFAULT_TEXT_COLOR = "#111827";
const DEFAULT_TEXT_PADDING = 8;

const measureTextBox = (
    value: string,
    fontSize: number,
    fontFamily: string,
    padding: number
) => {
    if (typeof document === "undefined") {
        return {
            width: Math.max(40, value.length * fontSize * 0.6 + padding * 2),
            height: fontSize + padding * 2,
        };
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return {
            width: Math.max(40, value.length * fontSize * 0.6 + padding * 2),
            height: fontSize + padding * 2,
        };
    }
    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(value);
    const textWidth = metrics.width;
    return {
        width: Math.max(40, textWidth + padding * 2),
        height: fontSize + padding * 2,
    };
};

const ShapeItem = React.memo(({
    shape,
    isSelected,
    onSelect,
    onChange,
    onDragStart,
    onDragEnd,
    isShiftDown,
    onMultiDragStart,
    onMultiDragMove,
    onMultiDragEnd,
    selectionCount,
    nodes,
    onSnap,
}: {
    shape: SeatmapShapeNode;
    isSelected: boolean;
    onSelect: (id: string, evt?: KonvaEventObject<MouseEvent | TouchEvent>) => void;
    onChange: (id: string, changes: Partial<SeatmapShapeNode>, history?: boolean) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    isShiftDown?: boolean;
    onMultiDragStart?: (id: string, pos: { x: number; y: number }) => boolean;
    onMultiDragMove?: (id: string, pos: { x: number; y: number }) => boolean;
    onMultiDragEnd?: (id: string, pos: { x: number; y: number }) => boolean;
    selectionCount: number;
    nodes: Record<string, SeatmapNode>;
    onSnap: (lines: {
        x: number | null;
        y: number | null;
        isSpacingX?: boolean;
        isSpacingY?: boolean;
        spacingValue?: number;
    }) => void;
}) => {
    const shapeNodeRef = React.useRef<KonvaNode | null>(null);
    const textNodeRef = React.useRef<KonvaText | null>(null);
    const transformerRef = React.useRef<KonvaTransformer | null>(null);
    const rafRef = React.useRef<number | null>(null);
    const pendingPosRef = React.useRef<{ x: number; y: number } | null>(null);

    React.useEffect(() => {
        if (isSelected && transformerRef.current && shapeNodeRef.current) {
            transformerRef.current.nodes([shapeNodeRef.current]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected]);

    const flushDragPosition = () => {
        if (!pendingPosRef.current) return;
        onChange(shape.id, { position: pendingPosRef.current }, false);
        pendingPosRef.current = null;
        rafRef.current = null;
    };

    const applyTransform = (evt?: Event, history?: boolean) => {
        if (!shapeNodeRef.current) return;
        let rotation = shapeNodeRef.current.rotation();
        const shiftKey = (evt && "shiftKey" in evt ? (evt as MouseEvent).shiftKey : false) || isShiftDown;
        if (shiftKey) {
            rotation = Math.round(rotation / ROTATION_SNAP) * ROTATION_SNAP;
            shapeNodeRef.current.rotation(rotation);
        }
        const scaleX = shapeNodeRef.current.scaleX();
        const scaleY = shape.shape === "text" ? scaleX : shapeNodeRef.current.scaleY();
        if (shape.shape === "text") {
            shapeNodeRef.current.scaleY(scaleY);
        }
        rotation = ((rotation % 360) + 360) % 360;
        onChange(shape.id, { rotation, scaleX, scaleY }, history);
    };

    const commonProps = {
        x: shape.position.x,
        y: shape.position.y,
        rotation: shape.rotation,
        scaleX: shape.scaleX,
        scaleY: shape.scaleY,
        id: shape.id,
        stroke: isSelected ? "#3b82f6" : shape.stroke || "#64748b",
        strokeWidth: isSelected ? 3 : shape.strokeWidth || 2,
        strokeScaleEnabled: false,
        fill: shape.fill,
        dash: shape.dash,
        draggable: isSelected,
        name: "shape-item selectable",
        onDragStart: () => {
            if (onDragStart) onDragStart();
            if (onMultiDragStart) {
                onMultiDragStart(shape.id, {
                    x: shape.position.x,
                    y: shape.position.y,
                });
            }
        },
        onClick: (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
            e.cancelBubble = true;
            onSelect(shape.id, e);
        },
        onTap: (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
            e.cancelBubble = true;
            onSelect(shape.id, e);
        },
        onDragEnd: (e: KonvaEventObject<DragEvent>) => {
            const handled = onMultiDragEnd
                ? onMultiDragEnd(shape.id, {
                    x: e.target.x(),
                    y: e.target.y(),
                })
                : false;
            if (!handled && selectionCount > 1) {
                onSnap({ x: null, y: null });
                if (onDragEnd) onDragEnd();
                return;
            }
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            pendingPosRef.current = null;
            if (!handled) {
                const nextPos = { x: e.target.x(), y: e.target.y() };

                const draggedBB = getNodeBoundingBox({
                    ...shape,
                    position: nextPos
                });

                let bestSnapX: number | null = null;
                let bestSnapY: number | null = null;
                let isSpacingX = false;
                let isSpacingY = false;

              if (draggedBB) {
                const snap = getSnapResults(
                  draggedBB,
                  Object.values(nodes),
                  [shape.id],
                  0
                );
                nextPos.x = snap.x;
                nextPos.y = snap.y;
                bestSnapX = snap.snapX;
                bestSnapY = snap.snapY;
                isSpacingX = false;
                isSpacingY = false;
              }

                e.target.position(nextPos);
                onSnap({
                    x: bestSnapX,
                    y: bestSnapY,
                    isSpacingX,
                    isSpacingY,
                    spacingValue: undefined,
                });

                onChange(
                    shape.id,
                    {
                        position: nextPos,
                    },
                    true,
                );
            }
            onSnap({ x: null, y: null });
            if (onDragEnd) onDragEnd();
        },
        onDragMove: (e: KonvaEventObject<DragEvent>) => {
            const handled = onMultiDragMove
                ? onMultiDragMove(shape.id, {
                    x: e.target.x(),
                    y: e.target.y(),
                })
                : false;
            if (handled) return;
            if (selectionCount > 1) {
                onSnap({ x: null, y: null });
                return;
            }

            const nextPos = { x: e.target.x(), y: e.target.y() };

            const draggedBB = getNodeBoundingBox({
                ...shape,
                position: nextPos
            });

            let bestSnapX: number | null = null;
            let bestSnapY: number | null = null;
            let isSpacingX = false;
            let isSpacingY = false;

            if (draggedBB) {
              const snap = getSnapResults(
                draggedBB,
                Object.values(nodes),
                [shape.id],
                0
              );
              nextPos.x = snap.x;
              nextPos.y = snap.y;
              bestSnapX = snap.snapX;
              bestSnapY = snap.snapY;
              isSpacingX = false;
              isSpacingY = false;
            }

            e.target.position(nextPos);
            onSnap({
                x: bestSnapX,
                y: bestSnapY,
              isSpacingX,
              isSpacingY,
              spacingValue: undefined
            });

            pendingPosRef.current = nextPos;
            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(flushDragPosition);
            }
        },
        onTransform: (e: KonvaEventObject<Event>) => {
            if (selectionCount > 1) return;
            applyTransform(e?.evt, false);
        },
        onTransformEnd: (e: KonvaEventObject<Event>) => {
            if (selectionCount > 1) return;
            applyTransform(e?.evt, true);
        },
        shadowColor: "black",
        shadowBlur: isSelected ? 10 : 0,
        shadowOpacity: 0.3
    };

    switch (shape.shape) {
        case "text": {
            const textValue = shape.text ?? DEFAULT_TEXT;
            const fontSize = shape.fontSize ?? DEFAULT_FONT_SIZE;
            const fontFamily = shape.fontFamily ?? DEFAULT_FONT_FAMILY;
            const textColor = shape.textColor ?? DEFAULT_TEXT_COLOR;
            const padding = shape.padding ?? DEFAULT_TEXT_PADDING;
            const measured = measureTextBox(textValue, fontSize, fontFamily, padding);
            const width = shape.width ?? measured.width;
            const height = shape.height ?? measured.height;
            const fillColor = shape.fill;
            const strokeColor = isSelected ? commonProps.stroke : shape.stroke;
            const startInlineEdit = () => {
                if (typeof document === "undefined") return;
                const existingEditor = document.querySelector('textarea[data-seatmap-text-editor="true"]');
                if (existingEditor) return;

                const textNode = textNodeRef.current;
                if (!textNode) return;

                const stage = textNode.getStage();
                if (!stage) return;

                const absPos = textNode.absolutePosition();
                const stageBox = stage.container().getBoundingClientRect();
                const absScale = textNode.getAbsoluteScale();
                const absRotation = textNode.getAbsoluteRotation();

                const textarea = document.createElement("textarea");
                textarea.setAttribute("data-seatmap-text-editor", "true");
                textarea.value = shape.text ?? DEFAULT_TEXT;
                textarea.style.position = "fixed";
                textarea.style.left = `${stageBox.left + absPos.x}px`;
                textarea.style.top = `${stageBox.top + absPos.y}px`;
                textarea.style.width = `${Math.max(1, textNode.width() * absScale.x)}px`;
                textarea.style.height = `${Math.max(1, textNode.height() * absScale.y)}px`;
                textarea.style.fontSize = `${fontSize * absScale.y}px`;
                textarea.style.fontFamily = fontFamily;
                textarea.style.lineHeight = "1.2";
                textarea.style.color = textColor;
                textarea.style.background = "transparent";
                textarea.style.border = "1px solid #3b82f6";
                textarea.style.borderRadius = "4px";
                textarea.style.margin = "0";
                textarea.style.padding = "0";
                textarea.style.overflow = "hidden";
                textarea.style.outline = "none";
                textarea.style.resize = "none";
                textarea.style.whiteSpace = "pre-wrap";
                textarea.style.wordBreak = "break-word";
                textarea.style.transformOrigin = "left top";
                textarea.style.zIndex = "9999";
                if (absRotation) {
                    textarea.style.transform = `rotateZ(${absRotation}deg)`;
                }

                document.body.appendChild(textarea);
                textNode.hide();
                textNode.getLayer()?.batchDraw();
                textarea.focus();
                textarea.select();

                const syncTextareaSize = (value: string) => {
                    const box = measureTextBox(value || " ", fontSize, fontFamily, padding);
                    textarea.style.width = `${Math.max(1, box.width * absScale.x)}px`;
                    textarea.style.height = `${Math.max(1, box.height * absScale.y)}px`;
                };

                const cleanup = () => {
                    textarea.removeEventListener("keydown", onKeyDown);
                    textarea.removeEventListener("input", onInput);
                    textarea.removeEventListener("blur", onBlur);
                    if (textarea.parentNode) {
                        textarea.parentNode.removeChild(textarea);
                    }
                    textNode.show();
                    textNode.getLayer()?.batchDraw();
                };

                const commit = () => {
                    const nextText = textarea.value;
                    const nextBox = measureTextBox(nextText || " ", fontSize, fontFamily, padding);
                    onChange(
                        shape.id,
                        {
                            text: nextText,
                            width: nextBox.width,
                            height: nextBox.height,
                        },
                        true,
                    );
                    cleanup();
                };

                const cancel = () => {
                    cleanup();
                };

                const onInput = () => {
                    syncTextareaSize(textarea.value);
                };

                const onKeyDown = (event: KeyboardEvent) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        commit();
                    } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancel();
                    }
                };

                const onBlur = () => {
                    commit();
                };

                textarea.addEventListener("keydown", onKeyDown);
                textarea.addEventListener("input", onInput);
                textarea.addEventListener("blur", onBlur);
                syncTextareaSize(textarea.value);
            };

            return (
                <>
                    <Group
                        ref={(node) => {
                            shapeNodeRef.current = node;
                        }}
                        {...commonProps}
                        offsetX={width / 2}
                        offsetY={height / 2}
                        onDblClick={(e) => {
                            e.cancelBubble = true;
                            startInlineEdit();
                        }}
                        onDblTap={(e) => {
                            e.cancelBubble = true;
                            startInlineEdit();
                        }}
                    >
                        <Rect
                            width={width}
                            height={height}
                            fill={fillColor}
                            stroke={strokeColor}
                            strokeWidth={commonProps.strokeWidth}
                            strokeScaleEnabled={false}
                            dash={shape.dash}
                            cornerRadius={4}
                        />
                        <Text
                            ref={(node) => {
                                textNodeRef.current = node;
                            }}
                            x={padding}
                            y={padding}
                            width={Math.max(0, width - padding * 2)}
                            height={Math.max(0, height - padding * 2)}
                            text={textValue}
                            fontSize={fontSize}
                            fontFamily={fontFamily}
                            fill={textColor}
                            align="center"
                            verticalAlign="middle"
                        />
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
        }
        case "rect":
            return (
                <>
                    <Rect
                        ref={(node) => {
                            shapeNodeRef.current = node;
                        }}
                        {...commonProps}
                        width={shape.width || 50}
                        height={shape.height || 50}
                        offsetX={(shape.width || 50) / 2}
                        offsetY={(shape.height || 50) / 2}
                        cornerRadius={4}
                    />
                    {isSelected && selectionCount === 1 && (
                        <Transformer
                            ref={transformerRef}
                            rotateEnabled
                            resizeEnabled
                            keepRatio={!!isShiftDown}
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
        case "circle":
            return (
                <>
                    <Circle
                        ref={(node) => {
                            shapeNodeRef.current = node;
                        }}
                        {...commonProps}
                        radius={shape.radius || 30}
                    />
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
        case "polygon":
            return (
                <>
                    <RegularPolygon
                        ref={(node) => {
                            shapeNodeRef.current = node;
                        }}
                        {...commonProps}
                        sides={shape.sides || 6}
                        radius={shape.radius || 30}
                    />
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
        case "line":
            const rawPoints = shape.points || [0, 0, 100, 0];
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (let i = 0; i < rawPoints.length; i += 2) {
                minX = Math.min(minX, rawPoints[i]);
                maxX = Math.max(maxX, rawPoints[i]);
                minY = Math.min(minY, rawPoints[i + 1]);
                maxY = Math.max(maxY, rawPoints[i + 1]);
            }
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const centeredPoints = rawPoints.map((val, idx) => (
                idx % 2 === 0 ? val - centerX : val - centerY
            ));
            const startAbs = {
                x: shape.position.x + rawPoints[0],
                y: shape.position.y + rawPoints[1],
            };
            const endAbs = {
                x: shape.position.x + rawPoints[2],
                y: shape.position.y + rawPoints[3],
            };
            const getLinePositionFromTarget = (target: KonvaNode) => ({
                x: target.x() - centerX,
                y: target.y() - centerY,
            });
            const updateEndpoint = (
                index: 0 | 2,
                next: { x: number; y: number },
                history?: boolean,
                shiftKey?: boolean,
            ) => {
                let snapped = next;
                if (shiftKey) {
                    const otherIndex = index === 0 ? 2 : 0;
                    const otherAbs = {
                        x: shape.position.x + rawPoints[otherIndex],
                        y: shape.position.y + rawPoints[otherIndex + 1],
                    };
                    const dx = next.x - otherAbs.x;
                    const dy = next.y - otherAbs.y;
                    const length = Math.hypot(dx, dy);
                    if (length > 0) {
                        const step = Math.PI / 4;
                        const angle = Math.atan2(dy, dx);
                        const snappedAngle = Math.round(angle / step) * step;
                        snapped = {
                            x: otherAbs.x + Math.cos(snappedAngle) * length,
                            y: otherAbs.y + Math.sin(snappedAngle) * length,
                        };
                    }
                }
                const nextPoints = [...rawPoints];
                nextPoints[index] = snapped.x - shape.position.x;
                nextPoints[index + 1] = snapped.y - shape.position.y;
                const dx = nextPoints[2] - nextPoints[0];
                const dy = nextPoints[3] - nextPoints[1];
                if (Math.hypot(dx, dy) < MIN_LINE_LENGTH) return;
                onChange(shape.id, { points: nextPoints, scaleX: 1, scaleY: 1 }, history);
            };
            return (
                <>
                    <Line
                        ref={(node) => {
                            shapeNodeRef.current = node;
                        }}
                        {...commonProps}
                        x={shape.position.x + centerX}
                        y={shape.position.y + centerY}
                        points={centeredPoints}
                        scaleX={1}
                        scaleY={1}
                        tension={0}
                        hitStrokeWidth={10}
                        onDragMove={(e: KonvaEventObject<DragEvent>) => {
                            const nextPos = getLinePositionFromTarget(e.target);
                            const handled = onMultiDragMove
                                ? onMultiDragMove(shape.id, nextPos)
                                : false;
                            if (handled) return;
                            pendingPosRef.current = nextPos;
                            if (rafRef.current === null) {
                                rafRef.current = requestAnimationFrame(flushDragPosition);
                            }
                        }}
                        onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                            const nextPos = getLinePositionFromTarget(e.target);
                            const handled = onMultiDragEnd
                                ? onMultiDragEnd(shape.id, nextPos)
                                : false;
                            if (rafRef.current !== null) {
                                cancelAnimationFrame(rafRef.current);
                                rafRef.current = null;
                            }
                            pendingPosRef.current = null;
                            if (!handled) {
                                onChange(
                                    shape.id,
                                    {
                                        position: nextPos,
                                    },
                                    true,
                                );
                            }
                            if (onDragEnd) onDragEnd();
                        }}
                    />
                    {isSelected && selectionCount === 1 && (
                        <>
                            <Transformer ref={transformerRef} rotateEnabled resizeEnabled={false} enabledAnchors={[]} rotateAnchorOffset={24} />
                            <Circle
                                x={startAbs.x}
                                y={startAbs.y}
                                radius={5}
                                fill="#3b82f6"
                                stroke="#1e3a8a"
                                strokeWidth={1}
                                draggable
                                onDragMove={(e) =>
                                    updateEndpoint(0, { x: e.target.x(), y: e.target.y() }, false, e.evt?.shiftKey)
                                }
                                onDragEnd={(e) =>
                                    updateEndpoint(0, { x: e.target.x(), y: e.target.y() }, true, e.evt?.shiftKey)
                                }
                            />
                            <Circle
                                x={endAbs.x}
                                y={endAbs.y}
                                radius={5}
                                fill="#3b82f6"
                                stroke="#1e3a8a"
                                strokeWidth={1}
                                draggable
                                onDragMove={(e) =>
                                    updateEndpoint(2, { x: e.target.x(), y: e.target.y() }, false, e.evt?.shiftKey)
                                }
                                onDragEnd={(e) =>
                                    updateEndpoint(2, { x: e.target.x(), y: e.target.y() }, true, e.evt?.shiftKey)
                                }
                            />
                        </>
                    )}
                </>
            );
        case "stairs":
            const w = shape.width || 60;
            const h = shape.height || 60;
            const steps = 6;
            const stepSize = h / steps;

            return (
                <>
                    <Group
                        ref={(node) => {
                            shapeNodeRef.current = node;
                        }}
                        {...commonProps}
                        offsetX={w / 2}
                        offsetY={h / 2}
                    >
                        {/* Bounding box / Background */}
                        <Rect width={w} height={h} stroke={commonProps.stroke} strokeWidth={commonProps.strokeWidth} fill={shape.fill} cornerRadius={2} />

                        {/* Steps */}
                        {Array.from({ length: steps - 1 }).map((_, i) => (
                            <Line
                                key={i}
                                points={[0, (i + 1) * stepSize, w, (i + 1) * stepSize]}
                                stroke={commonProps.stroke}
                                strokeWidth={1}
                            />
                        ))}
                    </Group>
                    {isSelected && selectionCount === 1 && (
                        <Transformer
                            ref={transformerRef}
                            rotateEnabled
                            resizeEnabled
                            keepRatio={!!isShiftDown}
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
        default:
            return null;
    }
}, (prev, next) => {
    return (
        prev.shape === next.shape &&
        prev.isSelected === next.isSelected &&
        prev.selectionCount === next.selectionCount &&
        prev.isShiftDown === next.isShiftDown
    );
});

ShapeItem.displayName = "ShapeItem";

export default function SectionLayer({
    onNodeDragStart,
    onNodeDragEnd,
    stageRef,
    onSnap,
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
}) {
    const nodes = useAppSelector((state) => state.seatmap.nodes);
    const selectedIds = useAppSelector((state) => state.seatmap.selectedIds);
    const selectionCount = selectedIds.length;
    const dispatch = useAppDispatch();
    const [isShiftDown, setIsShiftDown] = React.useState(false);
    const multiDragRef = React.useRef<{
        active: boolean;
        draggedId: string | null;
        startPositions: Record<string, { x: number; y: number }>;
        historyGroupId: string | null;
        currentDelta: { x: number; y: number } | null;
    }>({ active: false, draggedId: null, startPositions: {}, historyGroupId: null, currentDelta: null });
    const multiDragRafRef = React.useRef<number | null>(null);
    const pendingMultiDragRef = React.useRef<Record<string, { x: number; y: number }> | null>(null);
    const multiDragKonvaNodesRef = React.useRef<Record<string, KonvaNode>>({});

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

    const shapes = Object.values(nodes).filter((node): node is SeatmapShapeNode => node.type === "shape");

  const beginMultiDrag = (id: string) => {
        const selectedShapeIds = selectedIds.filter((selectedId) => {
            const node = nodes[selectedId];
            return node?.type === "shape";
        });
        if (!selectedShapeIds.includes(id) || selectedShapeIds.length < 2) return false;
        const startPositions: Record<string, { x: number; y: number }> = {};
        const konvaNodes: Record<string, KonvaNode> = {};
        const stage = stageRef?.current;

        selectedShapeIds.forEach((selectedId) => {
            const node = nodes[selectedId];
            if (!node || node.type !== "shape") return;
            startPositions[selectedId] = {
                x: node.position.x,
                y: node.position.y,
            };
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
            historyGroupId: `multi-shape-drag:${Date.now()}:${id}`,
            currentDelta: { x: 0, y: 0 },
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

        const selectedShapeIds = Object.keys(state.startPositions);
        const draggedNodes = selectedShapeIds.map((sid) => {
            const node = nodes[sid];
            if (!node || node.type !== "shape") return null;
            if (sid === id) {
                return { ...node, position: { x: origin.x + dx, y: origin.y + dy } };
            }
            return {
                ...node,
                position: {
                    x: state.startPositions[sid].x + dx,
                    y: state.startPositions[sid].y + dy
                }
            };
        }).filter(Boolean) as SeatmapShapeNode[];

        const draggedBB = getNodesBoundingBox(draggedNodes);

        let bestSnapX: number | null = null;
        let bestSnapY: number | null = null;
        let isSpacingX = false;
        let isSpacingY = false;

        if (draggedBB) {
            const snap = getSnapResults(
                draggedBB,
                (Object.values(nodes) as SeatmapNode[]),
                selectedShapeIds,
                0
            );
            dx += (snap.x - draggedBB.centerX);
            dy += (snap.y - draggedBB.centerY);
            bestSnapX = snap.snapX;
            bestSnapY = snap.snapY;
            isSpacingX = false;
            isSpacingY = false;
        }

        onSnap({
            x: bestSnapX,
            y: bestSnapY,
            isSpacingX,
            isSpacingY,
            spacingValue: undefined
        });
        state.currentDelta = { x: dx, y: dy };

        const positions: Record<string, { x: number; y: number }> = {};
        Object.entries(state.startPositions).forEach(([nodeId, start]) => {
            positions[nodeId] = { x: start.x + dx, y: start.y + dy };
        });
        pendingMultiDragRef.current = positions;
        if (multiDragRafRef.current === null) {
            multiDragRafRef.current = requestAnimationFrame(() => {
                if (pendingMultiDragRef.current) {
                    const konvaNodes = multiDragKonvaNodesRef.current;
                    Object.entries(pendingMultiDragRef.current).forEach(([nodeId, next]) => {
                        const node = konvaNodes[nodeId];
                        if (node) {
                            node.position(next);
                        }
                    });
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
        const dx = state.currentDelta?.x ?? pos.x - origin.x;
        const dy = state.currentDelta?.y ?? pos.y - origin.y;
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
            historyGroupId: null,
            currentDelta: null,
        };
        dispatch(updateNodesPositions({
            positions,
            history: true,
            historyGroupId: state.historyGroupId ?? undefined,
        }));
        return true;
    };

    return (
        <Group>
            {shapes.map((shape) => (
                <ShapeItem
                    key={shape.id}
                    shape={shape}
                    isSelected={selectedIds.includes(shape.id)}
                    onSelect={(id: string, evt?: KonvaEventObject<MouseEvent | TouchEvent>) => {
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
                    onChange={(id: string, changes: Partial<SeatmapShapeNode>, history?: boolean) =>
                        dispatch(updateNode({ id, changes, history }))
                    }
                    onDragStart={onNodeDragStart}
                    onDragEnd={onNodeDragEnd}
                    isShiftDown={isShiftDown}
                    onMultiDragStart={(id: string) => beginMultiDrag(id)}
                    onMultiDragMove={(id: string, pos: { x: number; y: number }) =>
                        updateMultiDrag(id, pos)
                    }
                    onMultiDragEnd={(id: string, pos: { x: number; y: number }) =>
                        endMultiDrag(id, pos)
                    }
                    selectionCount={selectionCount}
                    nodes={nodes}
                    onSnap={onSnap}
                />
            ))}
        </Group>
    );
}
