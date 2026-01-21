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

const SeatItem = ({ seat, isSelected, onSelect, onChange }: any) => {
    const [image] = useImage(SEAT_IMAGE_URL);

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
            onClick={(e) => {
                e.cancelBubble = true;
                onSelect(seat.id);
            }}
            onTap={(e) => {
                e.cancelBubble = true;
                onSelect(seat.id);
            }}
            onDragEnd={(e) => {
                onChange(seat.id, {
                    position: { x: e.target.x(), y: e.target.y() },
                });
            }}
            name="seat-group"
        >
            {/* Background shape for "inside" coloring */}
            {isSelected && (
                <Rect
                    x={4}
                    y={4}
                    width={24}
                    height={24}
                    fill="#3b82f6"
                    cornerRadius={4}
                    listening={false}
                />
            )}
            <KonvaImage
                image={image}
                width={32}
                height={32}
                name="seat-image"
                shadowColor="black"
                shadowBlur={isSelected ? 5 : 0}
                shadowOpacity={0.3}
            />
        </Group>
    );
};

export default function SeatLayer() {
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
                />
            ))}
        </Layer>
    );
}
