import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SeatmapNode, SeatmapSeatNode, SeatmapShapeNode, SeatmapViewport } from "@/lib/seatmap/types";
import { v4 as uuidv4 } from "uuid";

interface SeatmapState {
    nodes: Record<string, SeatmapNode>;
    viewport: SeatmapViewport;
    mode: "select" | "pan" | "draw";
    selectedIds: string[];
    drawShape: {
        shape: SeatmapShapeNode["shape"] | "guidePath";
        dash?: number[];
        sides?: number;
    };
    showGuidePaths: boolean;
    showGrid: boolean;
    viewportSize: {
        width: number;
        height: number;
    };
    clipboard: SeatmapNode[];
    history: {
        past: Array<{ nodes: Record<string, SeatmapNode>; selectedIds: string[] }>;
        future: Array<{ nodes: Record<string, SeatmapNode>; selectedIds: string[] }>;
    };
    zoomLocked: boolean;
    snapSpacing: number;
}

const initialState: SeatmapState = {
    nodes: {},
    viewport: { position: { x: 0, y: 0 }, scale: 1 },
    mode: "select",
    selectedIds: [],
    drawShape: { shape: "rect" },
    showGuidePaths: true,
    showGrid: false,
    viewportSize: { width: 800, height: 600 },
    clipboard: [],
    history: { past: [], future: [] },
    zoomLocked: false,
    snapSpacing: 0,
};

const HISTORY_LIMIT = 15;

const snapshotState = (state: SeatmapState) => ({
    nodes: { ...state.nodes },
    selectedIds: [...state.selectedIds],
});

const pushHistory = (state: SeatmapState) => {
    state.history.past.push(snapshotState(state));
    if (state.history.past.length > HISTORY_LIMIT) {
        state.history.past.shift();
    }
    state.history.future = [];
};

const restoreSnapshot = (
    state: SeatmapState,
    snapshot: { nodes: Record<string, SeatmapNode>; selectedIds: string[] }
) => {
    state.nodes = { ...snapshot.nodes };
    state.selectedIds = [...snapshot.selectedIds];
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
                shape: SeatmapShapeNode["shape"] | "guidePath";
                dash?: number[];
                sides?: number;
            }>
        ) => {
            state.drawShape = action.payload;
        },
        setShowGuidePaths: (state, action: PayloadAction<boolean>) => {
            state.showGuidePaths = action.payload;
        },
        setShowGrid: (state, action: PayloadAction<boolean>) => {
            state.showGrid = action.payload;
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
        toggleZoomLock: (state) => {
            state.zoomLocked = !state.zoomLocked;
        },
        setSnapSpacing: (state, action: PayloadAction<number>) => {
            state.snapSpacing = action.payload;
        },
        addSeat: (
            state,
            action: PayloadAction<{ x: number; y: number; seatType?: "standard" | "vip" }>
        ) => {
            pushHistory(state);
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
        addSeatGrid: (
            state,
            action: PayloadAction<{
                rows: number;
                cols: number;
                center: { x: number; y: number };
                gap?: number;
            }>
        ) => {
            const { rows, cols, center, gap } = action.payload;
            if (rows <= 0 || cols <= 0) return;
            pushHistory(state);
            const seatSize = 32;
            const step = seatSize + (gap ?? 4);
            const startX = center.x - ((cols - 1) * step) / 2;
            const startY = center.y - ((rows - 1) * step) / 2;
            for (let row = 0; row < rows; row += 1) {
                for (let col = 0; col < cols; col += 1) {
                    const id = uuidv4();
                    const newSeat: SeatmapSeatNode = {
                        id,
                        type: "seat",
                        position: {
                            x: startX + col * step,
                            y: startY + row * step,
                        },
                        status: "available",
                        rotation: 0,
                        scaleX: 1,
                        scaleY: 1,
                        seatType: "standard",
                    };
                    state.nodes[id] = newSeat;
                }
            }
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
                text?: string;
                fontSize?: number;
                fontFamily?: string;
                textColor?: string;
                padding?: number;
            }>
        ) => {
            pushHistory(state);
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
                text,
                fontSize,
                fontFamily,
                textColor,
                padding,
            } = action.payload;

            // Define default sizes based on shape
            let defaultWidth = 50;
            let defaultHeight = 50;
            let defaultRadius = 30;
            let defaultPoints = undefined;
            let defaultText = text ?? "Text";
            let defaultFontSize = fontSize ?? 18;
            let defaultFontFamily = fontFamily ?? "Inter";
            let defaultTextColor = textColor ?? "#111827";
            let defaultPadding = padding ?? 8;

            if (shape === "line") {
                defaultWidth = 0;
                defaultHeight = 0;
                defaultRadius = 0;
                defaultPoints = [0, 0, 100, 0];
            } else if (shape === "stairs") {
                defaultWidth = 60;
                defaultHeight = 60;
            } else if (shape === "text") {
                defaultWidth = Math.max(
                    40,
                    defaultText.length * defaultFontSize * 0.6 + defaultPadding * 2
                );
                defaultHeight = defaultFontSize + defaultPadding * 2;
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
                sides,
                text: shape === "text" ? defaultText : undefined,
                fontSize: shape === "text" ? defaultFontSize : undefined,
                fontFamily: shape === "text" ? defaultFontFamily : undefined,
                textColor: shape === "text" ? defaultTextColor : undefined,
                padding: shape === "text" ? defaultPadding : undefined,
            };
            state.nodes[id] = newShape;
        },
        addGuidePath: (
            state,
            action: PayloadAction<{
                points: number[];
                dash?: number[];
                stroke?: string;
                strokeWidth?: number;
            }>
        ) => {
            pushHistory(state);
            const id = uuidv4();
            state.nodes[id] = {
                id,
                type: "helper",
                helperType: "guidePath",
                position: { x: 0, y: 0 },
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                points: action.payload.points,
                dash: action.payload.dash ?? [6, 4],
                stroke: action.payload.stroke ?? "#9ca3af",
                strokeWidth: action.payload.strokeWidth ?? 2,
            };
        },
        updateNode: (
            state,
            action: PayloadAction<{ id: string; changes: Partial<SeatmapNode>; history?: boolean }>
        ) => {
            const { id, changes, history } = action.payload;
            if (state.nodes[id]) {
                if (history !== false) {
                    pushHistory(state);
                }
                const updated = { ...state.nodes[id], ...changes } as SeatmapNode;
                // @ts-ignore - complex union type merging
                state.nodes[id] = updated;
            }
        },
        updateNodes: (
            state,
            action: PayloadAction<{
                changes: Record<string, Partial<SeatmapNode>>;
                history?: boolean;
            }>
        ) => {
            const { changes, history } = action.payload;
            const ids = Object.keys(changes);
            if (!ids.length) return;
            if (history !== false) {
                pushHistory(state);
            }
            ids.forEach((id) => {
                const node = state.nodes[id];
                if (!node) return;
                const updated = { ...node, ...changes[id] } as SeatmapNode;
                // @ts-ignore - complex union type merging
                state.nodes[id] = updated;
            });
        },
        updateNodesPositions: (
            state,
            action: PayloadAction<{
                positions: Record<string, { x: number; y: number }>;
                history?: boolean;
            }>
        ) => {
            const { positions, history } = action.payload;
            const ids = Object.keys(positions);
            if (!ids.length) return;
            if (history !== false) {
                pushHistory(state);
            }
            ids.forEach((id) => {
                const node = state.nodes[id];
                if (!node) return;
                node.position = {
                    x: positions[id].x,
                    y: positions[id].y,
                };
            });
        },
        selectNode: (state, action: PayloadAction<string>) => {
            state.selectedIds = [action.payload];
        },
        toggleSelectNode: (state, action: PayloadAction<string>) => {
            const id = action.payload;
            if (state.selectedIds.includes(id)) {
                state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id);
                return;
            }
            state.selectedIds = [...state.selectedIds, id];
        },
        setSelectedIds: (state, action: PayloadAction<string[]>) => {
            state.selectedIds = action.payload;
        },
        deselectAll: (state) => {
            state.selectedIds = [];
        },
        rotateSelected: (state, action: PayloadAction<number>) => {
            if (state.selectedIds.length) {
                pushHistory(state);
            }
            state.selectedIds.forEach((id) => {
                if (state.nodes[id]) {
                    const currentRotation = state.nodes[id].rotation || 0;
                    state.nodes[id].rotation = currentRotation + action.payload;
                }
            });
        },
        scaleSelected: (state, action: PayloadAction<number>) => {
            if (state.selectedIds.length) {
                pushHistory(state);
            }
            state.selectedIds.forEach((id) => {
                if (state.nodes[id]) {
                    const node = state.nodes[id] as SeatmapNode;
                    if (node.type === "shape" && node.shape === "line") {
                        if (Array.isArray(node.points)) {
                            node.points = node.points.map((value) => value * action.payload);
                        }
                        node.scaleX = 1;
                        node.scaleY = 1;
                        return;
                    }
                    const currentScaleX = node.scaleX || 1;
                    const currentScaleY = node.scaleY || 1;
                    node.scaleX = currentScaleX * action.payload;
                    node.scaleY = currentScaleY * action.payload;
                }
            });
        },
        copySelected: (state) => {
            state.clipboard = state.selectedIds
                .map((id) => state.nodes[id])
                .filter(Boolean)
                .map((node) => JSON.parse(JSON.stringify(node)) as SeatmapNode);
        },
        pasteNodesAt: (state, action: PayloadAction<{ x: number; y: number }>) => {
            if (!state.clipboard.length) return;
            pushHistory(state);
            const center = state.clipboard.reduce(
                (acc, node) => {
                    if (node.type === "helper" && node.helperType === "guidePath") {
                        const points = node.points ?? [];
                        if (points.length >= 2) {
                            acc.x += points[0];
                            acc.y += points[1];
                        }
                        return acc;
                    }
                    if ("position" in node) {
                        acc.x += node.position.x;
                        acc.y += node.position.y;
                    }
                    return acc;
                },
                { x: 0, y: 0 }
            );
            center.x /= state.clipboard.length;
            center.y /= state.clipboard.length;

            const offsetX = action.payload.x - center.x;
            const offsetY = action.payload.y - center.y;
            const newIds: string[] = [];

            state.clipboard.forEach((node) => {
                const id = uuidv4();
                const copy = JSON.parse(JSON.stringify(node)) as SeatmapNode;
                copy.id = id;
                if (copy.type === "helper" && copy.helperType === "guidePath") {
                    copy.points = (copy.points ?? []).map((value, index) =>
                        index % 2 === 0 ? value + offsetX : value + offsetY,
                    );
                } else if ("position" in copy) {
                    copy.position = {
                        x: copy.position.x + offsetX,
                        y: copy.position.y + offsetY,
                    };
                }
                state.nodes[id] = copy;
                newIds.push(id);
            });

            state.selectedIds = newIds;
        },
        deleteSelected: (state) => {
            if (!state.selectedIds.length) return;
            pushHistory(state);
            state.selectedIds.forEach((id) => {
                delete state.nodes[id];
            });
            state.selectedIds = [];
        },
        undo: (state) => {
            const previous = state.history.past.pop();
            if (!previous) return;
            state.history.future.push(snapshotState(state));
            restoreSnapshot(state, previous);
        },
        redo: (state) => {
            const next = state.history.future.pop();
            if (!next) return;
            state.history.past.push(snapshotState(state));
            restoreSnapshot(state, next);
        },
    },
});

export const {
    setMode,
    setDrawShape,
    setViewportSize,
    setViewport,
    addSeat,
    addSeatGrid,
    addShape,
    addGuidePath,
    updateNode,
    updateNodes,
    updateNodesPositions,
    selectNode,
    toggleSelectNode,
    setSelectedIds,
    deselectAll,
    rotateSelected,
    scaleSelected,
    setShowGuidePaths,
    setShowGrid,
    copySelected,
    pasteNodesAt,
    deleteSelected,
    undo,
    redo,
    toggleZoomLock,
    setSnapSpacing,
} = seatmapSlice.actions;

export default seatmapSlice.reducer;
