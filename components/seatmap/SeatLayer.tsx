"use client";

import React from "react";
import { Layer, Image as KonvaImage, Group, Rect } from "react-konva";
import useImage from "use-image";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
    selectNode,
    updateNode,
} from "@/lib/features/seatmap/seatmapSlice";

const SEAT_IMAGE_URL = "/armchair.svg";

const SeatItem = ({
    seat,
    isSelected,
    onSelect,
    onChange,
    onDragStart,
    onDragEnd,
}: any) => {
    const [image] = useImage(SEAT_IMAGE_URL);
    const rafRef = React.useRef<number | null>(null);
    const pendingPosRef = React.useRef<{ x: number; y: number } | null>(null);

    const flushDragPosition = () => {
        if (!pendingPosRef.current) return;
        onChange(seat.id, { position: pendingPosRef.current });
        pendingPosRef.current = null;
        rafRef.current = null;
    };

    return (
        <Group
            x={seat.position.x}
            y={seat.position.y}
            width={32}
            height={32}
            offsetX={16}
            offsetY={16}
            rotation={seat.rotation}
            scaleX={seat.scaleX}
            scaleY={seat.scaleY}
            draggable={isSelected}
            onDragStart={() => {
                if (onDragStart) onDragStart();
            }}
            onClick={(e) => {
                e.cancelBubble = true;
                onSelect(seat.id);
            }}
            onTap={(e) => {
                e.cancelBubble = true;
                onSelect(seat.id);
            }}
            onDragEnd={(e) => {
                if (rafRef.current !== null) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }
                pendingPosRef.current = null;
                onChange(seat.id, {
                    position: { x: e.target.x(), y: e.target.y() },
                });
                if (onDragEnd) onDragEnd();
            }}
            onDragMove={(e) => {
                pendingPosRef.current = { x: e.target.x(), y: e.target.y() };
                if (rafRef.current === null) {
                    rafRef.current = requestAnimationFrame(flushDragPosition);
                }
            }}
            name="seat-group"
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
            {isSelected && (
                <Rect
                    x={0}
                    y={0}
                    width={32}
                    height={32}
                    fill="#3b82f6"
                    globalCompositeOperation="source-in"
                    listening={false}
                />
            )}
        </Group>
    );
};

export default function SeatLayer({
    onNodeDragStart,
    onNodeDragEnd,
}: {
    onNodeDragStart?: () => void;
    onNodeDragEnd?: () => void;
}) {
    const nodes = useAppSelector((state) => state.seatmap.nodes);
    const selectedIds = useAppSelector((state) => state.seatmap.selectedIds);
    const dispatch = useAppDispatch();

    const seats = Object.values(nodes).filter((node) => node.type === "seat");

    return (
        <Layer>
            {seats.map((seat) => (
                <SeatItem
                    key={seat.id}
                    seat={seat}
                    isSelected={selectedIds.includes(seat.id)}
                    onSelect={(id: string) => dispatch(selectNode(id))}
                    onChange={(id: string, changes: any) =>
                        dispatch(updateNode({ id, changes }))
                    }
                    onDragStart={onNodeDragStart}
                    onDragEnd={onNodeDragEnd}
                />
            ))}
        </Layer>
    );
}
