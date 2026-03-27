"use client";

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

import {
  TICKET_TEMPLATE_CANVAS_PX_HEIGHT,
  TICKET_TEMPLATE_CANVAS_PX_WIDTH,
} from "../../tickets/constants.ts";
import {
  createEmptyTicketTemplate,
  normalizeTemplateVersion,
} from "../../tickets/templateSchema.ts";
import type {
  TicketTemplateAssetNode,
  TicketTemplateFieldNode,
  TicketTemplateNode,
  TicketTemplateQrNode,
  TicketTemplateVersion,
} from "../../tickets/types.ts";

export const TICKET_TEMPLATE_DEFAULT_TITLE = "Untitled Ticket Template";

export const TICKET_TEMPLATE_FIELD_OPTIONS = [
  { key: "show_name", label: "Show Name" },
  { key: "venue", label: "Venue" },
  { key: "show_date", label: "Show Date" },
  { key: "show_time", label: "Show Time" },
  { key: "section", label: "Section" },
  { key: "row", label: "Row" },
  { key: "seat", label: "Seat" },
  { key: "reservation_number", label: "Booking Ref" },
  { key: "customer_name", label: "Customer Name" },
] as const;

export type TicketTemplateFieldKey =
  (typeof TICKET_TEMPLATE_FIELD_OPTIONS)[number]["key"];

export type TicketTemplateTextAlign = "left" | "center" | "right";

type TicketTemplateEditorNodeBase = {
  id: string;
  kind: TicketTemplateNode["kind"];
  x: number;
  y: number;
  opacity: number;
};

export type TicketTemplateAssetEditorNode = TicketTemplateEditorNodeBase & {
  kind: "asset";
  width: number;
  height: number;
  assetKey?: string | null;
  src: string | null;
  name: string | null;
};

export type TicketTemplateFieldEditorNode = TicketTemplateEditorNodeBase & {
  kind: "field";
  fieldKey: string;
  label: string;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fill: string;
  align: TicketTemplateTextAlign;
};

export type TicketTemplateQrEditorNode = TicketTemplateEditorNodeBase & {
  kind: "qr";
  size: number;
};

export type TicketTemplateEditorNode =
  | TicketTemplateAssetEditorNode
  | TicketTemplateFieldEditorNode
  | TicketTemplateQrEditorNode;

type TicketTemplateHistorySnapshot = {
  title: string;
  nodes: TicketTemplateEditorNode[];
  selectedNodeId: string | null;
};

export type TicketTemplateState = {
  ticketTemplateId: string | null;
  loadedVersionId: string | null;
  title: string;
  canvas: {
    width: number;
    height: number;
  };
  nodes: TicketTemplateEditorNode[];
  selectedNodeId: string | null;
  hasUnsavedChanges: boolean;
  history: {
    past: TicketTemplateHistorySnapshot[];
    future: TicketTemplateHistorySnapshot[];
  };
};

const HISTORY_LIMIT = 30;

const FIELD_LABEL_MAP = new Map<string, string>(
  TICKET_TEMPLATE_FIELD_OPTIONS.map((field) => [field.key, field.label]),
);

function getFieldLabel(fieldKey: string) {
  return FIELD_LABEL_MAP.get(fieldKey) ?? fieldKey.replaceAll("_", " ");
}

function cloneNodes(nodes: TicketTemplateEditorNode[]) {
  return JSON.parse(JSON.stringify(nodes)) as TicketTemplateEditorNode[];
}

function createHistorySnapshot(
  state: Pick<TicketTemplateState, "title" | "nodes" | "selectedNodeId">,
): TicketTemplateHistorySnapshot {
  return {
    title: state.title,
    nodes: cloneNodes(state.nodes),
    selectedNodeId: state.selectedNodeId,
  };
}

function restoreHistorySnapshot(
  state: TicketTemplateState,
  snapshot: TicketTemplateHistorySnapshot,
) {
  state.title = snapshot.title;
  state.nodes = cloneNodes(snapshot.nodes);
  state.selectedNodeId = snapshot.selectedNodeId;
}

function pushHistory(state: TicketTemplateState) {
  state.history.past.push(createHistorySnapshot(state));
  if (state.history.past.length > HISTORY_LIMIT) {
    state.history.past.shift();
  }
  state.history.future = [];
  state.hasUnsavedChanges = true;
}

function clampNumber(value: unknown, fallback: number, minimum = 0) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, value);
}

function clampOpacity(value: unknown) {
  return Math.min(1, clampNumber(value, 1, 0));
}

function sortEditorNodes(nodes: TicketTemplateEditorNode[]) {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((left, right) => {
      const leftOrder = left.node.kind === "asset" ? 0 : 1;
      const rightOrder = right.node.kind === "asset" ? 0 : 1;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.index - right.index;
    })
    .map(({ node }) => node);
}

function hydrateAssetNode(node: TicketTemplateAssetNode): TicketTemplateAssetEditorNode {
  return {
    ...node,
    kind: "asset",
    opacity: clampOpacity(node.opacity),
    src: node.src ?? node.assetKey ?? null,
    name: node.name ?? node.assetKey ?? null,
  };
}

function hydrateFieldNode(node: TicketTemplateFieldNode): TicketTemplateFieldEditorNode {
  return {
    ...node,
    kind: "field",
    opacity: clampOpacity(node.opacity),
    label: node.label ?? getFieldLabel(node.fieldKey),
    width: clampNumber(node.width, 420, 80),
    fontSize: clampNumber(node.fontSize, 64, 12),
    fontFamily: node.fontFamily ?? "Georgia",
    fontWeight: clampNumber(node.fontWeight, 700, 100),
    fill: node.fill ?? "#111827",
    align: node.align ?? "left",
  };
}

function hydrateQrNode(node: TicketTemplateQrNode): TicketTemplateQrEditorNode {
  return {
    ...node,
    kind: "qr",
    opacity: clampOpacity(node.opacity),
  };
}

function hydrateTemplateNodes(
  template: Partial<TicketTemplateVersion> | null | undefined,
) {
  return normalizeTemplateVersion(template)
    .nodes.map((node) => {
      switch (node.kind) {
        case "asset":
          return hydrateAssetNode(node);
        case "field":
          return hydrateFieldNode(node);
        case "qr":
          return hydrateQrNode(node);
      }
    })
    .filter(Boolean) as TicketTemplateEditorNode[];
}

function createInitialState(): TicketTemplateState {
  const emptyTemplate = createEmptyTicketTemplate();

  return {
    ticketTemplateId: null,
    loadedVersionId: null,
    title: TICKET_TEMPLATE_DEFAULT_TITLE,
    canvas: emptyTemplate.canvas,
    nodes: [],
    selectedNodeId: null,
    hasUnsavedChanges: false,
    history: {
      past: [],
      future: [],
    },
  };
}

function createFieldNode(fieldKey: string): TicketTemplateFieldEditorNode {
  return {
    id: uuidv4(),
    kind: "field",
    fieldKey,
    label: getFieldLabel(fieldKey),
    x: 180,
    y: 120,
    width: 420,
    fontSize: 64,
    fontFamily: "Georgia",
    fontWeight: 700,
    fill: "#111827",
    align: "left",
    opacity: 1,
  };
}

function createQrNode(): TicketTemplateQrEditorNode {
  return {
    id: uuidv4(),
    kind: "qr",
    x: 2140,
    y: 120,
    size: 240,
    opacity: 1,
  };
}

const initialState = createInitialState();

const ticketTemplateSlice = createSlice({
  name: "ticketTemplate",
  initialState,
  reducers: {
    resetTicketTemplate: () => createInitialState(),
    markTicketTemplateSaved(state) {
      state.hasUnsavedChanges = false;
    },
    registerSavedTicketTemplate(
      state,
      action: PayloadAction<{
        ticketTemplateId: string;
        loadedVersionId: string;
        title: string;
      }>,
    ) {
      state.ticketTemplateId = action.payload.ticketTemplateId;
      state.loadedVersionId = action.payload.loadedVersionId;
      state.title = action.payload.title.trim() || TICKET_TEMPLATE_DEFAULT_TITLE;
      state.hasUnsavedChanges = false;
    },
    setTitle(state, action: PayloadAction<string>) {
      pushHistory(state);
      state.title = action.payload.trim() || TICKET_TEMPLATE_DEFAULT_TITLE;
    },
    updateCanvasSize(state) {
      state.canvas.width = TICKET_TEMPLATE_CANVAS_PX_WIDTH;
      state.canvas.height = TICKET_TEMPLATE_CANVAS_PX_HEIGHT;
    },
    loadTicketTemplate(
      state,
      action: PayloadAction<{
        ticketTemplateId?: string | null;
        loadedVersionId?: string | null;
        title?: string | null;
        template?: Partial<TicketTemplateVersion> | null;
      }>,
    ) {
      const nextState = createInitialState();

      nextState.ticketTemplateId = action.payload.ticketTemplateId ?? null;
      nextState.loadedVersionId = action.payload.loadedVersionId ?? null;
      nextState.title =
        action.payload.title?.trim() || TICKET_TEMPLATE_DEFAULT_TITLE;
      nextState.nodes = hydrateTemplateNodes(action.payload.template);
      nextState.hasUnsavedChanges = false;

      return nextState;
    },
    replaceNodes(state, action: PayloadAction<TicketTemplateNode[]>) {
      pushHistory(state);
      state.nodes = sortEditorNodes(hydrateTemplateNodes({ nodes: action.payload }));
      state.selectedNodeId = state.nodes[0]?.id ?? null;
    },
    addFieldNode(
      state,
      action: PayloadAction<{ fieldKey: string; x?: number; y?: number }>,
    ) {
      pushHistory(state);
      const node = createFieldNode(action.payload.fieldKey);
      node.x = clampNumber(action.payload.x, node.x);
      node.y = clampNumber(action.payload.y, node.y);
      state.nodes = sortEditorNodes([...state.nodes, node]);
      state.selectedNodeId = node.id;
    },
    addQrNode(
      state,
      action: PayloadAction<{ x?: number; y?: number } | undefined>,
    ) {
      pushHistory(state);
      const node = createQrNode();
      node.x = clampNumber(action.payload?.x, node.x);
      node.y = clampNumber(action.payload?.y, node.y);
      state.nodes = sortEditorNodes([...state.nodes, node]);
      state.selectedNodeId = node.id;
    },
    addAssetNode(
      state,
      action: PayloadAction<{
        width: number;
        height: number;
        src: string;
        assetKey?: string | null;
        name?: string | null;
        x?: number;
        y?: number;
      }>,
    ) {
      pushHistory(state);
      const node: TicketTemplateAssetEditorNode = {
        id: uuidv4(),
        kind: "asset",
        x: clampNumber(action.payload.x, 180),
        y: clampNumber(action.payload.y, 120),
        width: clampNumber(action.payload.width, 320, 24),
        height: clampNumber(action.payload.height, 180, 24),
        opacity: 1,
        src: action.payload.src,
        assetKey: action.payload.assetKey ?? null,
        name: action.payload.name ?? null,
      };

      state.nodes = sortEditorNodes([...state.nodes, node]);
      state.selectedNodeId = node.id;
    },
    selectNode(state, action: PayloadAction<string | null>) {
      state.selectedNodeId = action.payload;
    },
    clearSelectedNode(state) {
      state.selectedNodeId = null;
    },
    updateNode(
      state,
      action: PayloadAction<{
        id: string;
        changes: Partial<TicketTemplateEditorNode>;
      }>,
    ) {
      const nodeIndex = state.nodes.findIndex((node) => node.id === action.payload.id);
      if (nodeIndex === -1) {
        return;
      }

      pushHistory(state);

      const currentNode = state.nodes[nodeIndex];
      const nextNode = {
        ...currentNode,
        ...action.payload.changes,
      } as TicketTemplateEditorNode;

      nextNode.x = clampNumber(nextNode.x, currentNode.x);
      nextNode.y = clampNumber(nextNode.y, currentNode.y);
      nextNode.opacity = clampOpacity(nextNode.opacity);

      if (nextNode.kind === "asset" && currentNode.kind === "asset") {
        nextNode.width = clampNumber(nextNode.width, currentNode.width, 24);
        nextNode.height = clampNumber(nextNode.height, currentNode.height, 24);
      }

      if (nextNode.kind === "field" && currentNode.kind === "field") {
        nextNode.width = clampNumber(nextNode.width, currentNode.width, 80);
        nextNode.fontSize = clampNumber(nextNode.fontSize, currentNode.fontSize, 12);
        nextNode.fontWeight = clampNumber(
          nextNode.fontWeight,
          currentNode.fontWeight,
          100,
        );
      }

      if (nextNode.kind === "qr" && currentNode.kind === "qr") {
        nextNode.size = clampNumber(nextNode.size, currentNode.size, 48);
      }

      state.nodes[nodeIndex] = nextNode;
      state.nodes = sortEditorNodes(state.nodes);
    },
    duplicateSelectedNode(state) {
      const currentNode = state.nodes.find((node) => node.id === state.selectedNodeId);
      if (!currentNode) {
        return;
      }

      pushHistory(state);

      const duplicate = {
        ...JSON.parse(JSON.stringify(currentNode)),
        id: uuidv4(),
        x: currentNode.x + 36,
        y: currentNode.y + 36,
      } as TicketTemplateEditorNode;

      state.nodes = sortEditorNodes([...state.nodes, duplicate]);
      state.selectedNodeId = duplicate.id;
    },
    deleteSelectedNode(state) {
      if (!state.selectedNodeId) {
        return;
      }

      pushHistory(state);
      state.nodes = state.nodes.filter((node) => node.id !== state.selectedNodeId);
      state.selectedNodeId = state.nodes.at(-1)?.id ?? null;
    },
    moveAssetLayer(
      state,
      action: PayloadAction<{ id: string; direction: "up" | "down" }>,
    ) {
      const assetNodes = state.nodes.filter((node) => node.kind === "asset");
      const assetIndex = assetNodes.findIndex((node) => node.id === action.payload.id);
      if (assetIndex === -1) {
        return;
      }

      const targetIndex =
        action.payload.direction === "up" ? assetIndex + 1 : assetIndex - 1;

      if (targetIndex < 0 || targetIndex >= assetNodes.length) {
        return;
      }

      pushHistory(state);

      const reorderedAssets = [...assetNodes];
      const [assetNode] = reorderedAssets.splice(assetIndex, 1);
      reorderedAssets.splice(targetIndex, 0, assetNode);

      const overlayNodes = state.nodes.filter((node) => node.kind !== "asset");
      state.nodes = [...reorderedAssets, ...overlayNodes];
    },
    undo(state) {
      const previous = state.history.past.pop();
      if (!previous) {
        return;
      }

      state.history.future.push(createHistorySnapshot(state));
      restoreHistorySnapshot(state, previous);
      state.hasUnsavedChanges = state.history.past.length > 0;
    },
    redo(state) {
      const next = state.history.future.pop();
      if (!next) {
        return;
      }

      state.history.past.push(createHistorySnapshot(state));
      restoreHistorySnapshot(state, next);
      state.hasUnsavedChanges = true;
    },
  },
});

export const {
  addAssetNode,
  addFieldNode,
  addQrNode,
  clearSelectedNode,
  deleteSelectedNode,
  duplicateSelectedNode,
  loadTicketTemplate,
  markTicketTemplateSaved,
  moveAssetLayer,
  redo,
  registerSavedTicketTemplate,
  replaceNodes,
  resetTicketTemplate,
  selectNode,
  setTitle,
  undo,
  updateCanvasSize,
  updateNode,
} = ticketTemplateSlice.actions;

export function serializeTicketTemplateEditor(
  state: Pick<TicketTemplateState, "canvas" | "nodes">,
): TicketTemplateVersion {
  return {
    canvas: {
      width: state.canvas.width,
      height: state.canvas.height,
    },
    nodes: state.nodes.map((node) => {
      switch (node.kind) {
        case "asset":
          return {
            id: node.id,
            kind: "asset",
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            opacity: node.opacity,
            assetKey: node.assetKey ?? undefined,
            src: node.src ?? undefined,
            name: node.name ?? undefined,
          };
        case "field":
          return {
            id: node.id,
            kind: "field",
            fieldKey: node.fieldKey,
            label: node.label,
            x: node.x,
            y: node.y,
            width: node.width,
            fontSize: node.fontSize,
            fontFamily: node.fontFamily,
            fontWeight: node.fontWeight,
            fill: node.fill,
            align: node.align,
            opacity: node.opacity,
          };
        case "qr":
          return {
            id: node.id,
            kind: "qr",
            x: node.x,
            y: node.y,
            size: node.size,
            opacity: node.opacity,
          };
      }
    }),
  };
}

export default ticketTemplateSlice.reducer;
