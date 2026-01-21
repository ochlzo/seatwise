import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SeatmapNode, SeatmapSeatNode, SeatmapShapeNode, SeatmapViewport } from "@/lib/seatmap/types";
import { v4 as uuidv4 } from "uuid";

interface SeatmapState {
    nodes: Record<string, SeatmapNode>;
    viewport: SeatmapViewport;
    mode: "select" | "pan" | "draw";
    selectedIds: string[];
    drawShape: {
        shape: SeatmapShapeNode["shape"];
        dash?: number[];
        sides?: number;
    };
    viewportSize: {
        width: number;
        height: number;
    };
}

const initialState: SeatmapState = {
    nodes: {},
    viewport: { position: { x: 0, y: 0 }, scale: 1 },
    mode: "select",
    selectedIds: [],
    drawShape: { shape: "rect" },
    viewportSize: { width: 800, height: 600 },
};

const seatmapSlice = createSlice({
    name: "seatmap",
    initialState,
    reducers: {
        setMode: (state, action: PayloadAction<"select" | "pan" | "draw">) => {
            state.mode = action.payload;
        },
        setDrawShape: (
            state,
            action: PayloadAction<{
                shape: SeatmapShapeNode["shape"];
                dash?: number[];
                sides?: number;
            }>
        ) => {
            state.drawShape = action.payload;
        },
        setViewportSize: (
            state,
            action: PayloadAction<{ width: number; height: number }>
        ) => {
            state.viewportSize = action.payload;
        },
        setViewport: (state, action: PayloadAction<SeatmapViewport>) => {
            state.viewport = action.payload;
        },
        addSeat: (
            state,
            action: PayloadAction<{ x: number; y: number; seatType?: "standard" | "vip" }>
        ) => {
            const id = uuidv4();
            const newSeat: SeatmapSeatNode = {
                id,
                type: "seat",
                position: action.payload,
                status: "available",
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                seatType: action.payload.seatType ?? "standard",
            };
            state.nodes[id] = newSeat;
        },
        addShape: (
            state,
            action: PayloadAction<{
                x: number;
                y: number;
                shape: SeatmapShapeNode["shape"];
                dash?: number[];
                sides?: number;
                width?: number;
                height?: number;
                radius?: number;
                points?: number[];
                fill?: string;
                stroke?: string;
                strokeWidth?: number;
            }>
        ) => {
            const id = uuidv4();
            const {
                x,
                y,
                shape,
                dash,
                sides,
                width,
                height,
                radius,
                points,
                fill,
                stroke,
                strokeWidth,
            } = action.payload;

            // Define default sizes based on shape
            let defaultWidth = 50;
            let defaultHeight = 50;
            let defaultRadius = 30;
            let defaultPoints = undefined;

            if (shape === "line") {
                defaultWidth = 0;
                defaultHeight = 0;
                defaultRadius = 0;
                defaultPoints = [0, 0, 100, 0];
            } else if (shape === "stairs") {
                defaultWidth = 60;
                defaultHeight = 60;
            }

            const newShape: SeatmapShapeNode = {
                id,
                type: "shape",
                shape,
                position: { x, y },
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                width: width ?? defaultWidth,
                height: height ?? defaultHeight,
                radius: radius ?? defaultRadius,
                fill: fill ?? (shape === "line" ? undefined : "#cbd5e1"),
                stroke: stroke ?? "#64748b",
                strokeWidth: strokeWidth ?? 2,
                dash,
                points: points ?? defaultPoints,
                sides
            };
            state.nodes[id] = newShape;
        },
        updateNode: (
            state,
            action: PayloadAction<{ id: string; changes: Partial<SeatmapNode> }>
        ) => {
            const { id, changes } = action.payload;
            if (state.nodes[id]) {
                const updated = { ...state.nodes[id], ...changes } as SeatmapNode;
                // @ts-ignore - complex union type merging
                state.nodes[id] = updated;
            }
        },
        selectNode: (state, action: PayloadAction<string>) => {
            state.selectedIds = [action.payload];
        },
        deselectAll: (state) => {
            state.selectedIds = [];
        },
        rotateSelected: (state, action: PayloadAction<number>) => {
            state.selectedIds.forEach((id) => {
                if (state.nodes[id]) {
                    const currentRotation = state.nodes[id].rotation || 0;
                    state.nodes[id].rotation = currentRotation + action.payload;
                }
            });
        },
        scaleSelected: (state, action: PayloadAction<number>) => {
            state.selectedIds.forEach((id) => {
                if (state.nodes[id]) {
                    const currentScaleX = state.nodes[id].scaleX || 1;
                    const currentScaleY = state.nodes[id].scaleY || 1;
                    state.nodes[id].scaleX = currentScaleX * action.payload;
                    state.nodes[id].scaleY = currentScaleY * action.payload;
                }
            });
        }
    },
});

export const {
    setMode,
    setDrawShape,
    setViewportSize,
    setViewport,
    addSeat,
    addShape,
    updateNode,
    selectNode,
    deselectAll,
    rotateSelected,
    scaleSelected
} = seatmapSlice.actions;

export default seatmapSlice.reducer;
