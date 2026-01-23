"use client";

import React from "react";
import { Image as KonvaImage, Group, Rect, Transformer } from "react-konva";
import useImage from "use-image";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
    selectNode,
    toggleSelectNode,
    updateNode,
    updateNodesPositions,
    updateNodes,
} from "@/lib/features/seatmap/seatmapSlice";
import { closestPointOnPolyline } from "@/lib/seatmap/geometry";
import { GuidePathNode } from "@/lib/seatmap/types";

const SEAT_IMAGE_URL = "/seat-default.svg";
const SEAT_SELECTED_IMAGE_URL = "/seat-selected.svg";
const VIP_SEAT_IMAGE_URL = "/default-vip-seat.svg";
const VIP_SEAT_SELECTED_IMAGE_URL = "/selected-vip-seat.svg";
const ROTATION_SNAP = 15;
const MIN_SIZE = 16;
const MAX_SIZE = 320;
const SNAP_THRESHOLD = 12;

const getSnappedPosition = (
    position: { x: number; y: number },
    guidePaths: GuidePathNode[],
) => {
    let closest = null as null | { x: number; y: number; distance: number; guideId: string };
    guidePaths.forEach((guide) => {
        const result = closestPointOnPolyline(position.x, position.y, guide.points);
        if (result.distance <= SNAP_THRESHOLD) {
            if (!closest || result.distance < closest.distance) {
                closest = {
                    x: result.point.x,
                    y: result.point.y,
                    distance: result.distance,
                    guideId: guide.id,
                };
            }
        }
    });
    if (!closest) return null;
    return { x: closest.x, y: closest.y, guideId: closest.guideId };
};

const SeatItem = React.memo(({
    seat,
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
    showGuidePaths,
    guidePaths,
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
    const pendingSnapGuideIdRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (isSelected && transformerRef.current && groupRef.current) {
            transformerRef.current.nodes([groupRef.current]);
            transformerRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected]);

    const flushDragPosition = () => {
        if (!pendingPosRef.current) return;
        onChange(
            seat.id,
            {
                position: pendingPosRef.current,
                snapGuideId: pendingSnapGuideIdRef.current ?? undefined,
            },
            false,
        );
        pendingPosRef.current = null;
        pendingSnapGuideIdRef.current = null;
        rafRef.current = null;
    };

    const applyTransform = (evt?: Event, history?: boolean) => {
        if (!groupRef.current) return;
        let rotation = groupRef.current.rotation();
        const shiftKey = (evt as any)?.shiftKey || isShiftDown;
        if (shiftKey) {
            rotation = Math.round(rotation / ROTATION_SNAP) * ROTATION_SNAP;
            groupRef.current.rotation(rotation);
        }
        const scaleX = groupRef.current.scaleX();
        const scaleY = scaleX;
        groupRef.current.scaleY(scaleY);
        rotation = ((rotation % 360) + 360) % 360;
        onChange(seat.id, { rotation, scaleX, scaleY }, history);
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
                    if (onMultiDragStart) {
                        onMultiDragStart(seat.id, {
                            x: seat.position.x,
                            y: seat.position.y,
                        });
                    }
                }}
                onClick={(e) => {
                    e.cancelBubble = true;
                    onSelect(seat.id, e);
                }}
                onTap={(e) => {
                    e.cancelBubble = true;
                    onSelect(seat.id, e);
                }}
                onDragEnd={(e) => {
                    const handled = onMultiDragEnd
                        ? onMultiDragEnd(seat.id, {
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
                        let nextPos = { x: e.target.x(), y: e.target.y() };
                        let snapGuideId: string | undefined = undefined;
                        if (showGuidePaths && guidePaths.length) {
                            const snapped = getSnappedPosition(nextPos, guidePaths);
                            if (snapped) {
                                nextPos = snapped;
                                e.target.position(nextPos);
                                snapGuideId = snapped.guideId;
                            }
                        }
                        onChange(
                            seat.id,
                            {
                                position: nextPos,
                                snapGuideId,
                            },
                            true,
                        );
                    }
                    if (onDragEnd) onDragEnd();
                }}
                onDragMove={(e) => {
                    const handled = onMultiDragMove
                        ? onMultiDragMove(seat.id, {
                            x: e.target.x(),
                            y: e.target.y(),
                        })
                        : false;
                    if (handled) return;
                    let nextPos = { x: e.target.x(), y: e.target.y() };
                    if (showGuidePaths && guidePaths.length) {
                        const snapped = getSnappedPosition(nextPos, guidePaths);
                        if (snapped) {
                            nextPos = snapped;
                            e.target.position(nextPos);
                            pendingSnapGuideIdRef.current = snapped.guideId;
                        } else {
                            pendingSnapGuideIdRef.current = null;
                        }
                    } else {
                        pendingSnapGuideIdRef.current = null;
                    }
                    pendingPosRef.current = nextPos;
                    if (rafRef.current === null) {
                        rafRef.current = requestAnimationFrame(flushDragPosition);
                    }
                }}
                onTransform={(e) => applyTransform(e?.evt, false)}
                onTransformEnd={(e) => applyTransform(e?.evt, true)}
                id={seat.id}
                name="seat-group seat-item selectable"
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
}, (prev, next) => {
    return (
        prev.seat === next.seat &&
        prev.isSelected === next.isSelected &&
        prev.selectionCount === next.selectionCount &&
        prev.isShiftDown === next.isShiftDown &&
        prev.showGuidePaths === next.showGuidePaths &&
        prev.guidePaths.length === next.guidePaths.length
    );
});

export default function SeatLayer({
    onNodeDragStart,
    onNodeDragEnd,
    stageRef,
}: {
    onNodeDragStart?: () => void;
    onNodeDragEnd?: () => void;
    stageRef?: React.RefObject<any>;
}) {
    const nodes = useAppSelector((state) => state.seatmap.nodes);
    const selectedIds = useAppSelector((state) => state.seatmap.selectedIds);
    const showGuidePaths = useAppSelector((state) => state.seatmap.showGuidePaths);
    const selectionCount = selectedIds.length;
    const dispatch = useAppDispatch();
    const [isShiftDown, setIsShiftDown] = React.useState(false);
    const multiDragRef = React.useRef<{
        active: boolean;
        draggedId: string | null;
        startPositions: Record<string, { x: number; y: number }>;
        snapGuideId?: string | null;
    }>({ active: false, draggedId: null, startPositions: {} });
    const multiDragRafRef = React.useRef<number | null>(null);
    const pendingMultiDragRef = React.useRef<Record<string, { x: number; y: number }> | null>(null);

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

    const seats = Object.values(nodes).filter((node) => node.type === "seat");
    const guidePaths = Object.values(nodes).filter(
        (node): node is GuidePathNode =>
            node.type === "helper" && node.helperType === "guidePath",
    );

    const multiDragKonvaNodesRef = React.useRef<Record<string, any>>({});

    const beginMultiDrag = (id: string) => {
        if (!selectedIds.includes(id) || selectedIds.length < 2) return false;
        const startPositions: Record<string, { x: number; y: number }> = {};
        const konvaNodes: Record<string, any> = {};
        const stage = stageRef?.current;

        selectedIds.forEach((selectedId) => {
            const node = nodes[selectedId];
            if (!node || node.type !== "seat") return;
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
            snapGuideId: null,
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
        let snapGuideId: string | null = null;
        if (showGuidePaths && guidePaths.length) {
            const snapped = getSnappedPosition(
                { x: origin.x + dx, y: origin.y + dy },
                guidePaths,
            );
            if (snapped) {
                dx = snapped.x - origin.x;
                dy = snapped.y - origin.y;
                snapGuideId = snapped.guideId;
            }
        }
        multiDragRef.current.snapGuideId = snapGuideId;
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
        let dx = pos.x - origin.x;
        let dy = pos.y - origin.y;
        let snapGuideId: string | null = state.snapGuideId ?? null;
        if (showGuidePaths && guidePaths.length) {
            const snapped = getSnappedPosition(
                { x: origin.x + dx, y: origin.y + dy },
                guidePaths,
            );
            if (snapped) {
                dx = snapped.x - origin.x;
                dy = snapped.y - origin.y;
                snapGuideId = snapped.guideId;
            } else {
                snapGuideId = null;
            }
        }
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
        const snapChanges: Record<string, { snapGuideId?: string }> = {};
        selectedIds.forEach((selectedId) => {
            const node = nodes[selectedId];
            if (!node || node.type !== "seat") return;
            snapChanges[selectedId] = {
                snapGuideId: snapGuideId ?? undefined,
            };
        });
        if (Object.keys(snapChanges).length) {
            dispatch(updateNodes({ changes: snapChanges, history: false }));
        }
        multiDragRef.current = {
            active: false,
            draggedId: null,
            startPositions: {},
            snapGuideId: null,
        };
        dispatch(updateNodesPositions({ positions, history: true }));
        return true;
    };

    return (
        <Group>
            {seats.map((seat) => (
                <SeatItem
                    key={seat.id}
                    seat={seat}
                    isSelected={selectedIds.includes(seat.id)}
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
                    showGuidePaths={showGuidePaths}
                    guidePaths={guidePaths}
                />
            ))}
        </Group>
    );
}
