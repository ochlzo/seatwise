import {
  TICKET_TEMPLATE_CANVAS_PX_HEIGHT,
  TICKET_TEMPLATE_CANVAS_PX_WIDTH,
  TICKET_TEMPLATE_NODE_KINDS,
} from "./constants.ts";
import type {
  TicketTemplateAssetNode,
  TicketTemplateFieldNode,
  TicketTemplateNode,
  TicketTemplateNodeKind,
  TicketTemplateQrNode,
  TicketTemplateVersion,
} from "./types.ts";

const NODE_ORDER: Record<TicketTemplateNodeKind, number> = {
  asset: 0,
  field: 1,
  qr: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function toNullableStringValue(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toAlignValue(value: unknown): "left" | "center" | "right" {
  return value === "center" || value === "right" ? value : "left";
}

function isTicketTemplateNodeKind(value: unknown): value is TicketTemplateNodeKind {
  return (
    typeof value === "string" &&
    TICKET_TEMPLATE_NODE_KINDS.includes(value as TicketTemplateNodeKind)
  );
}

function normalizeAssetNode(
  node: Record<string, unknown>,
  index: number,
): TicketTemplateAssetNode {
  return {
    id: toStringValue(node.id, `asset-${index}`),
    kind: "asset",
    x: toFiniteNumber(node.x),
    y: toFiniteNumber(node.y),
    width: toFiniteNumber(node.width),
    height: toFiniteNumber(node.height),
    opacity: toFiniteNumber(node.opacity, 1),
    assetKey:
      typeof node.assetKey === "string" || node.assetKey === null
        ? node.assetKey
        : undefined,
    src: toNullableStringValue(node.src),
    name: toNullableStringValue(node.name),
  };
}

function normalizeFieldNode(
  node: Record<string, unknown>,
  index: number,
): TicketTemplateFieldNode {
  return {
    id: toStringValue(node.id, `field-${index}`),
    kind: "field",
    fieldKey: toStringValue(node.fieldKey, ""),
    label: toStringValue(node.label, toStringValue(node.fieldKey, "")),
    x: toFiniteNumber(node.x),
    y: toFiniteNumber(node.y),
    width: toFiniteNumber(node.width, 420),
    fontSize: toFiniteNumber(node.fontSize, 64),
    fontFamily: toStringValue(node.fontFamily, "Georgia"),
    fontWeight: toFiniteNumber(node.fontWeight, 700),
    fill: toStringValue(node.fill, "#111827"),
    align: toAlignValue(node.align),
    opacity: toFiniteNumber(node.opacity, 1),
  };
}

function normalizeQrNode(
  node: Record<string, unknown>,
  index: number,
): TicketTemplateQrNode {
  return {
    id: toStringValue(node.id, `qr-${index}`),
    kind: "qr",
    x: toFiniteNumber(node.x),
    y: toFiniteNumber(node.y),
    size: toFiniteNumber(node.size),
    opacity: toFiniteNumber(node.opacity, 1),
  };
}

function normalizeNode(
  node: unknown,
  index: number,
): TicketTemplateNode | null {
  if (!isRecord(node) || !isTicketTemplateNodeKind(node.kind)) {
    return null;
  }

  switch (node.kind) {
    case "asset":
      return normalizeAssetNode(node, index);
    case "field":
      return normalizeFieldNode(node, index);
    case "qr":
      return normalizeQrNode(node, index);
    default:
      return null;
  }
}

export function createEmptyTicketTemplate(): TicketTemplateVersion {
  return {
    canvas: {
      width: TICKET_TEMPLATE_CANVAS_PX_WIDTH,
      height: TICKET_TEMPLATE_CANVAS_PX_HEIGHT,
    },
    nodes: [],
  };
}

export function normalizeTemplateVersion(
  input?: Partial<TicketTemplateVersion> | null,
): TicketTemplateVersion {
  const nodes = Array.isArray(input?.nodes)
    ? input.nodes
        .map((node, index) => normalizeNode(node, index))
        .filter((node): node is TicketTemplateNode => node !== null)
        .map((node, index) => ({ node, index }))
        .sort((left, right) => {
          const orderDifference =
            NODE_ORDER[left.node.kind] - NODE_ORDER[right.node.kind];

          return orderDifference !== 0 ? orderDifference : left.index - right.index;
        })
        .map(({ node }) => node)
    : [];

  return {
    canvas: {
      width: TICKET_TEMPLATE_CANVAS_PX_WIDTH,
      height: TICKET_TEMPLATE_CANVAS_PX_HEIGHT,
    },
    nodes,
  };
}
