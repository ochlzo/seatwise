"use strict";
"use client";

import React from "react";
import { Rect, Circle, RegularPolygon, Line, Group, Transformer, Text } from "react-konva";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
    selectNode,
    toggleSelectNode,
    updateNode,
    updateNodesPositions,
} from "@/lib/features/seatmap/seatmapSlice";
import { SeatmapShapeNode } from "@/lib/seatmap/types";

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

const ShapeItem = ({
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
}: {
    shape: SeatmapShapeNode;
    isSelected: boolean;
    onSelect: any;
    onChange: any;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    isShiftDown?: boolean;
    onMultiDragStart?: (id: string, pos: { x: number; y: number }) => boolean;
    onMultiDragMove?: (id: string, pos: { x: number; y: number }) => boolean;
    onMultiDragEnd?: (id: string, pos: { x: number; y: number }) => boolean;
    selectionCount: number;
}) => {
    const shapeRef = React.useRef<any>(null);
    const transformerRef = React.useRef<any>(null);
    const rafRef = React.useRef<number | null>(null);
    const pendingPosRef = React.useRef<{ x: number; y: number } | null>(null);

    React.useEffect(() => {
        if (isSelected && transformerRef.current && shapeRef.current) {
            transformerRef.current.nodes([shapeRef.current]);
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
        if (!shapeRef.current) return;
        let rotation = shapeRef.current.rotation();
        const shiftKey = (evt as any)?.shiftKey || isShiftDown;
        if (shiftKey) {
            rotation = Math.round(rotation / ROTATION_SNAP) * ROTATION_SNAP;
            shapeRef.current.rotation(rotation);
        }
        const scaleX = shapeRef.current.scaleX();
        const scaleY = shape.shape === "text" ? scaleX : shapeRef.current.scaleY();
        if (shape.shape === "text") {
            shapeRef.current.scaleY(scaleY);
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
        onClick: (e: any) => {
            e.cancelBubble = true;
            onSelect(shape.id, e);
        },
        onTap: (e: any) => {
            e.cancelBubble = true;
            onSelect(shape.id, e);
        },
        onDragEnd: (e: any) => {
            const handled = onMultiDragEnd
                ? onMultiDragEnd(shape.id, {
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
                onChange(
                    shape.id,
                    {
                        position: { x: e.target.x(), y: e.target.y() },
                    },
                    true,
                );
            }
            if (onDragEnd) onDragEnd();
        },
        onDragMove: (e: any) => {
            const handled = onMultiDragMove
                ? onMultiDragMove(shape.id, {
                      x: e.target.x(),
                      y: e.target.y(),
                  })
                : false;
            if (handled) return;
            pendingPosRef.current = { x: e.target.x(), y: e.target.y() };
            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(flushDragPosition);
            }
        },
        onTransform: (e: any) => applyTransform(e?.evt, false),
        onTransformEnd: (e: any) => applyTransform(e?.evt, true),
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

            return (
                <>
                    <Group
                        ref={shapeRef}
                        {...commonProps}
                        offsetX={width / 2}
                        offsetY={height / 2}
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
                    <Rect ref={shapeRef} {...commonProps} width={shape.width || 50} height={shape.height || 50} offsetX={(shape.width || 50) / 2} offsetY={(shape.height || 50) / 2} cornerRadius={4} />
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
                    <Circle ref={shapeRef} {...commonProps} radius={shape.radius || 30} />
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
                    <RegularPolygon ref={shapeRef} {...commonProps} sides={shape.sides || 6} radius={shape.radius || 30} />
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
            const updateEndpoint = (index: 0 | 2, next: { x: number; y: number }, history?: boolean) => {
                const nextPoints = [...rawPoints];
                nextPoints[index] = next.x - shape.position.x;
                nextPoints[index + 1] = next.y - shape.position.y;
                const dx = nextPoints[2] - nextPoints[0];
                const dy = nextPoints[3] - nextPoints[1];
                if (Math.hypot(dx, dy) < MIN_LINE_LENGTH) return;
                onChange(shape.id, { points: nextPoints, scaleX: 1, scaleY: 1 }, history);
            };
            return (
                <>
                    <Line
                        ref={shapeRef}
                        {...commonProps}
                        x={shape.position.x + centerX}
                        y={shape.position.y + centerY}
                        points={centeredPoints}
                        scaleX={1}
                        scaleY={1}
                        tension={0}
                        hitStrokeWidth={10}
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
                                onDragMove={(e) => updateEndpoint(0, { x: e.target.x(), y: e.target.y() }, false)}
                                onDragEnd={(e) => updateEndpoint(0, { x: e.target.x(), y: e.target.y() }, true)}
                            />
                            <Circle
                                x={endAbs.x}
                                y={endAbs.y}
                                radius={5}
                                fill="#3b82f6"
                                stroke="#1e3a8a"
                                strokeWidth={1}
                                draggable
                                onDragMove={(e) => updateEndpoint(2, { x: e.target.x(), y: e.target.y() }, false)}
                                onDragEnd={(e) => updateEndpoint(2, { x: e.target.x(), y: e.target.y() }, true)}
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
                    <Group ref={shapeRef} {...commonProps} offsetX={w / 2} offsetY={h / 2}>
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
};

export default function SectionLayer({
    onNodeDragStart,
    onNodeDragEnd,
}: {
    onNodeDragStart?: () => void;
    onNodeDragEnd?: () => void;
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
    }>({ active: false, draggedId: null, startPositions: {} });

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

    // @ts-ignore
    const shapes = Object.values(nodes).filter((node): node is SeatmapShapeNode => node.type === "shape");

    const beginMultiDrag = (id: string) => {
        if (!selectedIds.includes(id) || selectedIds.length < 2) return false;
        const startPositions: Record<string, { x: number; y: number }> = {};
        selectedIds.forEach((selectedId) => {
            const node = nodes[selectedId];
            if (!node) return;
            startPositions[selectedId] = {
                x: node.position.x,
                y: node.position.y,
            };
        });
        multiDragRef.current = {
            active: true,
            draggedId: id,
            startPositions,
        };
        return true;
    };

    const updateMultiDrag = (id: string, pos: { x: number; y: number }) => {
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
        dispatch(updateNodesPositions({ positions, history: false }));
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
            {shapes.map((shape) => (
                <ShapeItem
                    key={shape.id}
                    shape={shape}
                    isSelected={selectedIds.includes(shape.id)}
                    onSelect={(id: string, evt?: any) => {
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
                    onChange={(id: string, changes: any, history?: boolean) =>
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
                />
            ))}
        </Group>
    );
}
