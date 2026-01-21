import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SeatmapNode, SeatmapSeatNode, SeatmapShapeNode, SeatmapViewport } from "@/lib/seatmap/types";
import { v4 as uuidv4 } from "uuid";

interface SeatmapState {
    nodes: Record<string, SeatmapNode>;
    viewport: SeatmapViewport;
    mode: "select" | "pan";
    selectedIds: string[];
}

const initialState: SeatmapState = {
    nodes: {},
    viewport: { position: { x: 0, y: 0 }, scale: 1 },
    mode: "select",
    selectedIds: [],
};

const seatmapSlice = createSlice({
    name: "seatmap",
    initialState,
    reducers: {
        setMode: (state, action: PayloadAction<"select" | "pan">) => {
            state.mode = action.payload;
        },
        setViewport: (state, action: PayloadAction<SeatmapViewport>) => {
            state.viewport = action.payload;
        },
        addSeat: (state, action: PayloadAction<{ x: number; y: number }>) => {
            const id = uuidv4();
            const newSeat: SeatmapSeatNode = {
                id,
                type: "seat",
                position: action.payload,
                status: "available",
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
            };
            state.nodes[id] = newSeat;
        },
        addShape: (state, action: PayloadAction<{ x: number; y: number, shape: SeatmapShapeNode['shape'], dash?: number[], sides?: number }>) => {
            const id = uuidv4();
            const { x, y, shape, dash, sides } = action.payload;

            // Define default sizes based on shape
            let width = 50;
            let height = 50;
            let radius = 30;
            let points = undefined;

            if (shape === "line") {
                width = 0; height = 0; radius = 0;
                points = [0, 0, 100, 0];
            } else if (shape === "stairs") {
                width = 60; height = 60;
            }

            const newShape: SeatmapShapeNode = {
                id,
                type: "shape",
                shape,
                position: { x, y },
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                width,
                height,
                radius,
                fill: shape === 'line' ? undefined : '#cbd5e1',
                stroke: '#64748b',
                strokeWidth: 2,
                dash,
                points,
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
