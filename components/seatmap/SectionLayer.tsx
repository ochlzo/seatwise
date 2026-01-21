"use strict";
"use client";

import React from "react";
import { Layer, Rect, Circle, RegularPolygon, Line, Group, Transformer } from "react-konva";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { selectNode, updateNode } from "@/lib/features/seatmap/seatmapSlice";
import { SeatmapShapeNode } from "@/lib/seatmap/types";

const ROTATION_SNAP = 15;
const MIN_SIZE = 10;
const MAX_SIZE = 800;
const MIN_LINE_LENGTH = 6;

const ShapeItem = ({
    shape,
    isSelected,
    onSelect,
    onChange,
    onDragStart,
    onDragEnd,
    isShiftDown,
}: {
    shape: SeatmapShapeNode;
    isSelected: boolean;
    onSelect: any;
    onChange: any;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    isShiftDown?: boolean;
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
        onChange(shape.id, { position: pendingPosRef.current });
        pendingPosRef.current = null;
        rafRef.current = null;
    };

    const applyTransform = (evt?: Event) => {
        if (!shapeRef.current) return;
        let rotation = shapeRef.current.rotation();
        const shiftKey = (evt as any)?.shiftKey || isShiftDown;
        if (shiftKey) {
            rotation = Math.round(rotation / ROTATION_SNAP) * ROTATION_SNAP;
            shapeRef.current.rotation(rotation);
        }
        const scaleX = shapeRef.current.scaleX();
        const scaleY = shapeRef.current.scaleY();
        rotation = ((rotation % 360) + 360) % 360;
        onChange(shape.id, { rotation, scaleX, scaleY });
    };

    const commonProps = {
        x: shape.position.x,
        y: shape.position.y,
        rotation: shape.rotation,
        scaleX: shape.scaleX,
        scaleY: shape.scaleY,
        stroke: isSelected ? "#3b82f6" : shape.stroke || "#64748b",
        strokeWidth: isSelected ? 3 : shape.strokeWidth || 2,
        fill: shape.fill,
        dash: shape.dash,
        draggable: isSelected,
        name: "shape-item",
        onDragStart: () => {
            if (onDragStart) onDragStart();
        },
        onClick: (e: any) => {
            e.cancelBubble = true;
            onSelect(shape.id);
        },
        onTap: (e: any) => {
            e.cancelBubble = true;
            onSelect(shape.id);
        },
        onDragEnd: (e: any) => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            pendingPosRef.current = null;
            onChange(shape.id, {
                position: { x: e.target.x(), y: e.target.y() }
            });
            if (onDragEnd) onDragEnd();
        },
        onDragMove: (e: any) => {
            pendingPosRef.current = { x: e.target.x(), y: e.target.y() };
            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(flushDragPosition);
            }
        },
        onTransform: (e: any) => applyTransform(e?.evt),
        onTransformEnd: (e: any) => applyTransform(e?.evt),
        shadowColor: "black",
        shadowBlur: isSelected ? 10 : 0,
        shadowOpacity: 0.3
    };

    switch (shape.shape) {
        case "rect":
            return (
                <>
                    <Rect ref={shapeRef} {...commonProps} width={shape.width || 50} height={shape.height || 50} offsetX={(shape.width || 50) / 2} offsetY={(shape.height || 50) / 2} cornerRadius={4} />
                    {isSelected && (
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
                    {isSelected && (
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
                    {isSelected && (
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
            const updateEndpoint = (index: 0 | 2, next: { x: number; y: number }) => {
                const nextPoints = [...rawPoints];
                nextPoints[index] = next.x - shape.position.x;
                nextPoints[index + 1] = next.y - shape.position.y;
                const dx = nextPoints[2] - nextPoints[0];
                const dy = nextPoints[3] - nextPoints[1];
                if (Math.hypot(dx, dy) < MIN_LINE_LENGTH) return;
                onChange(shape.id, { points: nextPoints, scaleX: 1, scaleY: 1 });
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
                    {isSelected && (
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
                                onDragMove={(e) => updateEndpoint(0, { x: e.target.x(), y: e.target.y() })}
                            />
                            <Circle
                                x={endAbs.x}
                                y={endAbs.y}
                                radius={5}
                                fill="#3b82f6"
                                stroke="#1e3a8a"
                                strokeWidth={1}
                                draggable
                                onDragMove={(e) => updateEndpoint(2, { x: e.target.x(), y: e.target.y() })}
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
                    {isSelected && (
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
    const dispatch = useAppDispatch();
    const [isShiftDown, setIsShiftDown] = React.useState(false);

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

    return (
        <Layer>
            {shapes.map((shape) => (
                <ShapeItem
                    key={shape.id}
                    shape={shape}
                    isSelected={selectedIds.includes(shape.id)}
                    onSelect={(id: string) => dispatch(selectNode(id))}
                    onChange={(id: string, changes: any) => dispatch(updateNode({ id, changes }))}
                    onDragStart={onNodeDragStart}
                    onDragEnd={onNodeDragEnd}
                    isShiftDown={isShiftDown}
                />
            ))}
        </Layer>
    );
}
