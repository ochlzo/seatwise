"use client";

import React from "react";
import { Layer, Image as KonvaImage, Group, Rect, Transformer } from "react-konva";
import useImage from "use-image";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { selectNode, updateNode } from "@/lib/features/seatmap/seatmapSlice";

const SEAT_IMAGE_URL = "/seat-default.svg";
const SEAT_SELECTED_IMAGE_URL = "/seat-selected.svg";
const VIP_SEAT_IMAGE_URL = "/default-vip-seat.svg";
const VIP_SEAT_SELECTED_IMAGE_URL = "/selected-vip-seat.svg";
const ROTATION_SNAP = 15;

const SeatItem = ({
    seat,
    isSelected,
    onSelect,
    onChange,
    onDragStart,
    onDragEnd,
}: any) => {
    const seatType = seat.seatType ?? "standard";
    const imageUrl =
        seatType === "vip"
            ? (isSelected ? VIP_SEAT_SELECTED_IMAGE_URL : VIP_SEAT_IMAGE_URL)
            : (isSelected ? SEAT_SELECTED_IMAGE_URL : SEAT_IMAGE_URL);
    const [image] = useImage(imageUrl);
    const groupRef = React.useRef<any>(null);
    const transformerRef = React.useRef<any>(null);
    const rafRef = React.useRef<number | null>(null);
    const pendingPosRef = React.useRef<{ x: number; y: number } | null>(null);

    React.useEffect(() => {
        if (isSelected && transformerRef.current && groupRef.current) {
            transformerRef.current.nodes([groupRef.current]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected]);

    const flushDragPosition = () => {
        if (!pendingPosRef.current) return;
        onChange(seat.id, { position: pendingPosRef.current });
        pendingPosRef.current = null;
        rafRef.current = null;
    };

    const applyRotation = (evt?: Event) => {
        if (!groupRef.current) return;
        let rotation = groupRef.current.rotation();
        const shiftKey = (evt as any)?.shiftKey;
        if (shiftKey) {
            rotation = Math.round(rotation / ROTATION_SNAP) * ROTATION_SNAP;
            groupRef.current.rotation(rotation);
        }
        rotation = ((rotation % 360) + 360) % 360;
        onChange(seat.id, { rotation });
    };

    return (
        <>
            <Group
                ref={groupRef}
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
                onTransform={(e) => applyRotation(e?.evt)}
                onTransformEnd={(e) => applyRotation(e?.evt)}
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
            </Group>
            {isSelected && (
                <Transformer
                    ref={transformerRef}
                    rotateEnabled
                    resizeEnabled={false}
                    enabledAnchors={[]}
                    rotateAnchorOffset={24}
                />
            )}
        </>
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
