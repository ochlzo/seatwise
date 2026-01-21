"use strict";
"use client";

import React from "react";
import { Layer, Rect, Circle, RegularPolygon, Line, Group } from "react-konva";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { selectNode, updateNode } from "@/lib/features/seatmap/seatmapSlice";
import { SeatmapShapeNode } from "@/lib/seatmap/types";

const ShapeItem = ({ shape, isSelected, onSelect, onChange }: { shape: SeatmapShapeNode, isSelected: boolean, onSelect: any, onChange: any }) => {
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
        onClick: (e: any) => {
            e.cancelBubble = true;
            onSelect(shape.id);
        },
        onTap: (e: any) => {
            e.cancelBubble = true;
            onSelect(shape.id);
        },
        onDragEnd: (e: any) => {
            onChange(shape.id, {
                position: { x: e.target.x(), y: e.target.y() }
            });
        },
        shadowColor: "black",
        shadowBlur: isSelected ? 10 : 0,
        shadowOpacity: 0.3
    };

    switch (shape.shape) {
        case "rect":
            return <Rect {...commonProps} width={shape.width || 50} height={shape.height || 50} offsetX={(shape.width || 50) / 2} offsetY={(shape.height || 50) / 2} cornerRadius={4} />;
        case "circle":
            return <Circle {...commonProps} radius={shape.radius || 30} />;
        case "polygon":
            return <RegularPolygon {...commonProps} sides={shape.sides || 6} radius={shape.radius || 30} />;
        case "line":
            return <Line {...commonProps} points={shape.points || [0, 0, 100, 0]} tension={0} hitStrokeWidth={10} />;
        case "stairs":
            const w = shape.width || 60;
            const h = shape.height || 60;
            const steps = 6;
            const stepSize = h / steps;

            return (
                <Group {...commonProps} offsetX={w / 2} offsetY={h / 2}>
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
            );
        default:
            return null;
    }
};

export default function SectionLayer() {
    const nodes = useAppSelector((state) => state.seatmap.nodes);
    const selectedIds = useAppSelector((state) => state.seatmap.selectedIds);
    const dispatch = useAppDispatch();

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
                />
            ))}
        </Layer>
    );
}
