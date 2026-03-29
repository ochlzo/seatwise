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
  rotation: number;
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
  height: number;
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
  selectedNodeIds: string[];
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
  selectedNodeIds: string[];
  clipboard: TicketTemplateEditorNode[];
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
  state: Pick<
    TicketTemplateState,
    "title" | "nodes" | "selectedNodeId" | "selectedNodeIds"
  >,
): TicketTemplateHistorySnapshot {
  return {
    title: state.title,
    nodes: cloneNodes(state.nodes),
    selectedNodeId: state.selectedNodeId,
    selectedNodeIds: [...state.selectedNodeIds],
  };
}

function restoreHistorySnapshot(
  state: TicketTemplateState,
  snapshot: TicketTemplateHistorySnapshot,
) {
  state.title = snapshot.title;
  state.nodes = cloneNodes(snapshot.nodes);
  state.selectedNodeId = snapshot.selectedNodeId;
  state.selectedNodeIds = [...snapshot.selectedNodeIds];
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

function clampRotation(value: unknown, fallback = 0) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = ((value % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
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

function normalizeSelectionIds(nodes: TicketTemplateEditorNode[], ids: string[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const deduped: string[] = [];

  ids.forEach((id) => {
    if (!nodeIds.has(id)) {
      return;
    }
    if (deduped.includes(id)) {
      return;
    }
    deduped.push(id);
  });

  return deduped;
}

function syncSelection(
  state: TicketTemplateState,
  ids: string[],
  preferredPrimaryId?: string | null,
) {
  const selectedNodeIds = normalizeSelectionIds(state.nodes, ids);
  state.selectedNodeIds = selectedNodeIds;

  if (!selectedNodeIds.length) {
    state.selectedNodeId = null;
    return;
  }

  if (preferredPrimaryId && selectedNodeIds.includes(preferredPrimaryId)) {
    state.selectedNodeId = preferredPrimaryId;
    return;
  }

  if (state.selectedNodeId && selectedNodeIds.includes(state.selectedNodeId)) {
    return;
  }

  state.selectedNodeId = selectedNodeIds[selectedNodeIds.length - 1] ?? null;
}

function getEffectiveSelectionIds(state: TicketTemplateState) {
  const selectedFromState = normalizeSelectionIds(state.nodes, state.selectedNodeIds);
  if (selectedFromState.length > 0) {
    return selectedFromState;
  }

  if (!state.selectedNodeId) {
    return [];
  }

  return normalizeSelectionIds(state.nodes, [state.selectedNodeId]);
}

function applyNodeChanges(
  currentNode: TicketTemplateEditorNode,
  changes: Partial<TicketTemplateEditorNode>,
) {
  const nextNode = {
    ...currentNode,
    ...changes,
  } as TicketTemplateEditorNode;

  nextNode.x = clampNumber(nextNode.x, currentNode.x);
  nextNode.y = clampNumber(nextNode.y, currentNode.y);
  nextNode.rotation = clampRotation(nextNode.rotation, currentNode.rotation);
  nextNode.opacity = clampOpacity(nextNode.opacity);

  if (nextNode.kind === "asset" && currentNode.kind === "asset") {
    nextNode.width = clampNumber(nextNode.width, currentNode.width, 24);
    nextNode.height = clampNumber(nextNode.height, currentNode.height, 24);
  }

  if (nextNode.kind === "field" && currentNode.kind === "field") {
    nextNode.width = clampNumber(nextNode.width, currentNode.width, 80);
    nextNode.height = clampNumber(nextNode.height, currentNode.height, 24);
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

  return nextNode;
}

function hydrateAssetNode(node: TicketTemplateAssetNode): TicketTemplateAssetEditorNode {
  return {
    ...node,
    kind: "asset",
    opacity: clampOpacity(node.opacity),
    rotation: clampRotation(node.rotation, 0),
    src: node.src ?? node.assetKey ?? null,
    name: node.name ?? node.assetKey ?? null,
  };
}

function hydrateFieldNode(node: TicketTemplateFieldNode): TicketTemplateFieldEditorNode {
  const fontSize = clampNumber(node.fontSize, 64, 12);
  return {
    ...node,
    kind: "field",
    opacity: clampOpacity(node.opacity),
    rotation: clampRotation(node.rotation, 0),
    label: node.label ?? getFieldLabel(node.fieldKey),
    width: clampNumber(node.width, 420, 80),
    height: clampNumber(node.height, Math.ceil(fontSize * 1.4), 24),
    fontSize,
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
    rotation: clampRotation(node.rotation, 0),
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
    selectedNodeIds: [],
    clipboard: [],
    hasUnsavedChanges: false,
    history: {
      past: [],
      future: [],
    },
  };
}

function createFieldNode(fieldKey: string): TicketTemplateFieldEditorNode {
  const fontSize = 64;
  return {
    id: uuidv4(),
    kind: "field",
    fieldKey,
    label: getFieldLabel(fieldKey),
    x: 180,
    y: 120,
    rotation: 0,
    width: 420,
    height: Math.ceil(fontSize * 1.4),
    fontSize,
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
    rotation: 0,
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
      const firstId = state.nodes[0]?.id ?? null;
      syncSelection(state, firstId ? [firstId] : [], firstId);
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
      syncSelection(state, [node.id], node.id);
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
      syncSelection(state, [node.id], node.id);
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
        rotation: 0,
        width: clampNumber(action.payload.width, 320, 24),
        height: clampNumber(action.payload.height, 180, 24),
        opacity: 1,
        src: action.payload.src,
        assetKey: action.payload.assetKey ?? null,
        name: action.payload.name ?? null,
      };

      state.nodes = sortEditorNodes([...state.nodes, node]);
      syncSelection(state, [node.id], node.id);
    },
    selectNode(state, action: PayloadAction<string | null>) {
      if (!action.payload) {
        syncSelection(state, []);
        return;
      }

      syncSelection(state, [action.payload], action.payload);
    },
    selectNodes(state, action: PayloadAction<string[]>) {
      const preferred = action.payload[action.payload.length - 1] ?? null;
      syncSelection(state, action.payload, preferred);
    },
    toggleNodeInSelection(state, action: PayloadAction<string>) {
      const id = action.payload;
      const selected = getEffectiveSelectionIds(state);
      const isSelected = selected.includes(id);

      if (isSelected) {
        const remaining = selected.filter((selectedId) => selectedId !== id);
        syncSelection(state, remaining);
        return;
      }

      syncSelection(state, [...selected, id], id);
    },
    clearSelectedNode(state) {
      syncSelection(state, []);
    },
    clearSelectedNodes(state) {
      syncSelection(state, []);
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
      state.nodes[nodeIndex] = applyNodeChanges(
        state.nodes[nodeIndex],
        action.payload.changes,
      );
      state.nodes = sortEditorNodes(state.nodes);
    },
    updateNodes(
      state,
      action: PayloadAction<{
        changes: Array<{ id: string; changes: Partial<TicketTemplateEditorNode> }>;
      }>,
    ) {
      if (!action.payload.changes.length) {
        return;
      }

      let hasUpdate = false;
      action.payload.changes.forEach((entry) => {
        if (state.nodes.some((node) => node.id === entry.id)) {
          hasUpdate = true;
        }
      });

      if (!hasUpdate) {
        return;
      }

      pushHistory(state);

      action.payload.changes.forEach((entry) => {
        const nodeIndex = state.nodes.findIndex((node) => node.id === entry.id);
        if (nodeIndex === -1) {
          return;
        }

        state.nodes[nodeIndex] = applyNodeChanges(
          state.nodes[nodeIndex],
          entry.changes,
        );
      });

      state.nodes = sortEditorNodes(state.nodes);
    },
    duplicateSelectedNode(state) {
      const selectedIds = getEffectiveSelectionIds(state);
      if (!selectedIds.length) {
        return;
      }

      pushHistory(state);

      const duplicatedNodes: TicketTemplateEditorNode[] = [];
      const duplicateIds: string[] = [];

      selectedIds.forEach((selectedId) => {
        const currentNode = state.nodes.find((node) => node.id === selectedId);
        if (!currentNode) {
          return;
        }

        const duplicate = {
          ...JSON.parse(JSON.stringify(currentNode)),
          id: uuidv4(),
          x: currentNode.x + 36,
          y: currentNode.y + 36,
        } as TicketTemplateEditorNode;

        duplicatedNodes.push(duplicate);
        duplicateIds.push(duplicate.id);
      });

      if (!duplicatedNodes.length) {
        return;
      }

      state.nodes = sortEditorNodes([...state.nodes, ...duplicatedNodes]);
      syncSelection(state, duplicateIds, duplicateIds[duplicateIds.length - 1] ?? null);
    },
    deleteSelectedNode(state) {
      const selectedIds = getEffectiveSelectionIds(state);
      if (!selectedIds.length) {
        return;
      }

      pushHistory(state);
      const toDelete = new Set(selectedIds);
      state.nodes = state.nodes.filter((node) => !toDelete.has(node.id));
      syncSelection(state, []);
    },
    copySelectedNodes(state) {
      const selectedIds = getEffectiveSelectionIds(state);
      state.clipboard = selectedIds
        .map((id) => state.nodes.find((node) => node.id === id))
        .filter((node): node is TicketTemplateEditorNode => Boolean(node))
        .map((node) => JSON.parse(JSON.stringify(node)) as TicketTemplateEditorNode);
    },
    cutSelectedNodes(state) {
      const selectedIds = getEffectiveSelectionIds(state);
      if (!selectedIds.length) {
        return;
      }

      state.clipboard = selectedIds
        .map((id) => state.nodes.find((node) => node.id === id))
        .filter((node): node is TicketTemplateEditorNode => Boolean(node))
        .map((node) => JSON.parse(JSON.stringify(node)) as TicketTemplateEditorNode);

      pushHistory(state);
      const toDelete = new Set(selectedIds);
      state.nodes = state.nodes.filter((node) => !toDelete.has(node.id));
      syncSelection(state, []);
    },
    pasteNodesAt(state, action: PayloadAction<{ x: number; y: number }>) {
      if (!state.clipboard.length) {
        return;
      }

      pushHistory(state);

      const center = state.clipboard.reduce(
        (acc, node) => {
          acc.x += node.x;
          acc.y += node.y;
          return acc;
        },
        { x: 0, y: 0 },
      );

      center.x /= state.clipboard.length;
      center.y /= state.clipboard.length;

      const offsetX = action.payload.x - center.x;
      const offsetY = action.payload.y - center.y;

      const pastedNodes = state.clipboard.map((node) => {
        const copy = JSON.parse(JSON.stringify(node)) as TicketTemplateEditorNode;
        copy.id = uuidv4();
        copy.x = clampNumber(copy.x + offsetX, copy.x, 0);
        copy.y = clampNumber(copy.y + offsetY, copy.y, 0);
        return copy;
      });

      state.nodes = sortEditorNodes([...state.nodes, ...pastedNodes]);
      const pastedIds = pastedNodes.map((node) => node.id);
      syncSelection(state, pastedIds, pastedIds[pastedIds.length - 1] ?? null);
    },
    moveSelectedNodesBy(
      state,
      action: PayloadAction<{ dx: number; dy: number }>,
    ) {
      const { dx, dy } = action.payload;
      if (dx === 0 && dy === 0) {
        return;
      }

      const selectedIds = getEffectiveSelectionIds(state);
      if (!selectedIds.length) {
        return;
      }

      pushHistory(state);

      selectedIds.forEach((selectedId) => {
        const nodeIndex = state.nodes.findIndex((node) => node.id === selectedId);
        if (nodeIndex === -1) {
          return;
        }

        const node = state.nodes[nodeIndex];
        state.nodes[nodeIndex] = {
          ...node,
          x: clampNumber(node.x + dx, node.x, 0),
          y: clampNumber(node.y + dy, node.y, 0),
        };
      });
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
      syncSelection(state, state.selectedNodeIds, state.selectedNodeId);
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
  clearSelectedNodes,
  copySelectedNodes,
  cutSelectedNodes,
  deleteSelectedNode,
  duplicateSelectedNode,
  loadTicketTemplate,
  markTicketTemplateSaved,
  moveAssetLayer,
  moveSelectedNodesBy,
  pasteNodesAt,
  redo,
  registerSavedTicketTemplate,
  replaceNodes,
  resetTicketTemplate,
  selectNode,
  selectNodes,
  setTitle,
  toggleNodeInSelection,
  undo,
  updateCanvasSize,
  updateNode,
  updateNodes,
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
            ...(node.rotation ? { rotation: node.rotation } : {}),
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
            ...(node.rotation ? { rotation: node.rotation } : {}),
            width: node.width,
            height: node.height,
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
            ...(node.rotation ? { rotation: node.rotation } : {}),
            size: node.size,
            opacity: node.opacity,
          };
      }
    }),
  };
}

export default ticketTemplateSlice.reducer;
