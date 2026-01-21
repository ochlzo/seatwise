"use strict";
"use client";

import React, { useRef, useEffect } from "react";
import { Stage, Layer, Rect, Text, Group, Circle, RegularPolygon, Line } from "react-konva";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
    setViewport,
    addSeat,
    addShape,
    selectNode,
    deselectAll,
    updateNode,
    rotateSelected,
    scaleSelected,
} from "@/lib/features/seatmap/seatmapSlice";
import SeatLayer from "@/components/seatmap/SeatLayer";
import SectionLayer from "@/components/seatmap/SectionLayer";
import { getRelativePointerPosition } from "@/lib/seatmap/geometry";

export default function SeatmapCanvas() {
    const dispatch = useAppDispatch();
    const { viewport, mode, drawShape } = useAppSelector((state) => state.seatmap);
    const stageRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDraggingNode, setIsDraggingNode] = React.useState(false);
    const [drawDraft, setDrawDraft] = React.useState<{
        shape: typeof drawShape.shape;
        dash?: number[];
        sides?: number;
        start: { x: number; y: number };
        current: { x: number; y: number };
    } | null>(null);

    // Resize observer to keep stage responsive
    const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });


    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };

        // Initial setup
        updateDimensions();

        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Center view on load
    useEffect(() => {
        // Only center if we have actual dimensions (default is 800x600)
        // and we haven't touched the viewport yet (scale is 1, position is 0,0) - optional check
        // For this request, we just want to force center on mount when dimensions are ready

        if (dimensions.width !== 800 || dimensions.height !== 600) {
            // Content center approximation
            // X center is 0. Y center is around 200 (sections) to 400 (stage).
            // Let's aim for the section center ~200.
            const contentCenterX = 0;
            const contentCenterY = 200;

            const initialScale = 0.8; // Zoom out a bit to see everything

            const newX = (dimensions.width / 2) - (contentCenterX * initialScale);
            const newY = (dimensions.height / 2) - (contentCenterY * initialScale);

            dispatch(setViewport({
                position: { x: newX, y: newY },
                scale: initialScale
            }));
        }
    }, [dimensions, dispatch]);


    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only if we have a selection
            // We can't easily access Redux state here without a ref or dependency
            // But dispatch works

            // Check for valid keys first to avoid unnecessary dispatches
            if (['[', ']', '-', '='].includes(e.key)) {
                switch (e.key) {
                    case '[':
                        dispatch(rotateSelected(-5));
                        break;
                    case ']':
                        dispatch(rotateSelected(5));
                        break;
                    case '-':
                        dispatch(scaleSelected(0.9));
                        break;
                    case '=':
                        dispatch(scaleSelected(1.1));
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dispatch]);


    const handleWheel = (e: any) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;

        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        const scaleBy = 1.1;
        const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };

        dispatch(setViewport({ position: newPos, scale: newScale }));
    };

    const handleDragEnd = (e: any) => {
        const stage = stageRef.current;
        if (!stage || e.target !== stage) return;

        // Update viewport on pan end
        dispatch(setViewport({
            position: { x: stage.x(), y: stage.y() },
            scale: viewport.scale
        }));
    }

    const handleStageClick = (e: any) => {
        if (mode === "draw") return;
        if (e.target === e.target.getStage()) {
            dispatch(deselectAll());
            return;
        }
        // If clicked on section or something else that isn't a seat, deselect
        // Seat selection is handled in SeatItem
        // Shape selection is handled in ShapeItem
        if (!e.target.hasName('seat-image') && !e.target.hasName('shape-item')) {
            dispatch(deselectAll());
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;

        stage.setPointersPositions(e);
        const pointerPosition = stage.getPointerPosition();

        if (!pointerPosition) return;

        // Convert to relative stage coordinates
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = transform.point(pointerPosition);

        const type = e.dataTransfer.getData("type");
        const shape = e.dataTransfer.getData("shape");
        const seatType = e.dataTransfer.getData("seatType");

        if (type === "shape") {
            const sides = e.dataTransfer.getData("sides");
            const dashStr = e.dataTransfer.getData("dash");
            let dash = undefined;
            if (dashStr === "[5,5]") dash = [5, 5];

            dispatch(addShape({
                x: pos.x,
                y: pos.y,
                shape: shape as any,
                sides: sides ? parseInt(sides) : undefined,
                dash: dash
            }));
        } else {
            // Default to seat
            dispatch(addSeat({
                x: pos.x,
                y: pos.y,
                seatType: seatType === "vip" ? "vip" : "standard",
            }));
        }
    };

    const handleMouseDown = (e: any) => {
        if (mode !== "draw") return;
        if (e.evt && e.evt.button !== 0) return;
        if (e.target !== e.target.getStage()) return;

        const stage = stageRef.current;
        if (!stage) return;
        const pos = getRelativePointerPosition(stage);
        if (!pos) return;

        setDrawDraft({
            shape: drawShape.shape,
            dash: drawShape.dash,
            sides: drawShape.sides,
            start: pos,
            current: pos,
        });
    };

    const handleMouseMove = () => {
        if (!drawDraft) return;
        const stage = stageRef.current;
        if (!stage) return;
        const pos = getRelativePointerPosition(stage);
        if (!pos) return;
        setDrawDraft((prev) => (prev ? { ...prev, current: pos } : prev));
    };

    const handleMouseUp = () => {
        if (!drawDraft) return;

        const { start, current } = drawDraft;
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        const width = Math.abs(dx);
        const height = Math.abs(dy);
        const minSize = 4;

        if (drawDraft.shape === "line") {
            const length = Math.hypot(dx, dy);
            if (length >= minSize) {
                dispatch(addShape({
                    x: start.x,
                    y: start.y,
                    shape: "line",
                    dash: drawDraft.dash,
                    points: [0, 0, dx, dy],
                    strokeWidth: 2,
                }));
            }
            setDrawDraft(null);
            return;
        }

        if (width < minSize || height < minSize) {
            setDrawDraft(null);
            return;
        }

        const centerX = start.x + dx / 2;
        const centerY = start.y + dy / 2;

        if (drawDraft.shape === "rect") {
            dispatch(addShape({
                x: centerX,
                y: centerY,
                shape: "rect",
                width,
                height,
            }));
        } else if (drawDraft.shape === "circle") {
            const radius = Math.min(width, height) / 2;
            dispatch(addShape({
                x: centerX,
                y: centerY,
                shape: "circle",
                radius,
            }));
        } else if (drawDraft.shape === "polygon") {
            const radius = Math.min(width, height) / 2;
            dispatch(addShape({
                x: centerX,
                y: centerY,
                shape: "polygon",
                radius,
                sides: drawDraft.sides ?? 6,
            }));
        }

        setDrawDraft(null);
    };

    const renderDraft = () => {
        if (!drawDraft) return null;

        const { start, current } = drawDraft;
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        const width = Math.abs(dx);
        const height = Math.abs(dy);
        const centerX = start.x + dx / 2;
        const centerY = start.y + dy / 2;

        if (drawDraft.shape === "line") {
            return (
                <Line
                    points={[start.x, start.y, current.x, current.y]}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dash={drawDraft.dash}
                />
            );
        }

        if (drawDraft.shape === "rect") {
            return (
                <Rect
                    x={centerX}
                    y={centerY}
                    width={width}
                    height={height}
                    offsetX={width / 2}
                    offsetY={height / 2}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dash={[6, 4]}
                    fill="rgba(59, 130, 246, 0.15)"
                />
            );
        }

        if (drawDraft.shape === "circle") {
            const radius = Math.min(width, height) / 2;
            return (
                <Circle
                    x={centerX}
                    y={centerY}
                    radius={radius}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dash={[6, 4]}
                    fill="rgba(59, 130, 246, 0.15)"
                />
            );
        }

        if (drawDraft.shape === "polygon") {
            const radius = Math.min(width, height) / 2;
            return (
                <RegularPolygon
                    x={centerX}
                    y={centerY}
                    sides={drawDraft.sides ?? 6}
                    radius={radius}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dash={[6, 4]}
                    fill="rgba(59, 130, 246, 0.15)"
                />
            );
        }

        return null;
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
        >
            <Stage
                width={dimensions.width}
                height={dimensions.height}
                draggable={mode === "pan" && !isDraggingNode}
                onWheel={handleWheel}
                onClick={handleStageClick}
                onTap={handleStageClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                ref={stageRef}
                x={viewport.position.x}
                y={viewport.position.y}
                scaleX={viewport.scale}
                scaleY={viewport.scale}
                onDragEnd={handleDragEnd}
            >
                <Layer>
                    {/* Grid or Background could go here */}
                </Layer>

                <Layer listening={false}>
                    {renderDraft()}
                </Layer>

                <SectionLayer
                    onNodeDragStart={() => setIsDraggingNode(true)}
                    onNodeDragEnd={() => setIsDraggingNode(false)}
                />

                <Layer>
                    {/* Stage Label Removed */}
                </Layer>

                <SeatLayer
                    onNodeDragStart={() => setIsDraggingNode(true)}
                    onNodeDragEnd={() => setIsDraggingNode(false)}
                />

            </Stage>
        </div>
    );
}
