"use strict";
"use client";

import React, { useRef, useEffect } from "react";
import { Stage, Layer, Rect, Text, Group } from "react-konva";
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
    const { viewport, mode } = useAppSelector((state) => state.seatmap);
    const stageRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDraggingNode, setIsDraggingNode] = React.useState(false);

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
            dispatch(addSeat({ x: pos.x, y: pos.y }));
        }
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
