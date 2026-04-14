import type { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import type {
  SeatmapNode,
  SeatmapRowNode,
  SeatmapSeatNode,
} from "@/lib/seatmap/types";

export const extractSeatNodes = (
  seatmapJson: Prisma.InputJsonValue,
): SeatmapSeatNode[] => {
  if (!seatmapJson || typeof seatmapJson !== "object") return [];
  const nodes = (seatmapJson as { nodes?: Record<string, SeatmapNode> }).nodes;
  if (!nodes || typeof nodes !== "object") return [];
  return Object.values(nodes).filter(
    (node): node is SeatmapSeatNode =>
      Boolean(node) && typeof node === "object" && node.type === "seat",
  );
};

export const remapSeatIdsForSeatmapSave = (
  seatmapJson: Prisma.InputJsonValue,
): Prisma.InputJsonValue => {
  if (!seatmapJson || typeof seatmapJson !== "object") return seatmapJson;

  const cloned = JSON.parse(JSON.stringify(seatmapJson)) as {
    nodes?: Record<string, SeatmapNode>;
  };
  const nodes = cloned.nodes;
  if (!nodes || typeof nodes !== "object") return cloned;

  const seatIdMap = new Map<string, string>();
  Object.entries(nodes).forEach(([nodeId, node]) => {
    if (node && typeof node === "object" && node.type === "seat") {
      seatIdMap.set(nodeId, uuidv4());
    }
  });

  if (seatIdMap.size === 0) return cloned;

  const remappedNodes: Record<string, SeatmapNode> = {};
  Object.entries(nodes).forEach(([nodeId, node]) => {
    if (!node || typeof node !== "object") {
      remappedNodes[nodeId] = node as SeatmapNode;
      return;
    }

    if (node.type === "seat") {
      const nextId = seatIdMap.get(nodeId) ?? node.id;
      remappedNodes[nextId] = {
        ...node,
        id: nextId,
      } as SeatmapSeatNode;
      return;
    }

    if (node.type === "row") {
      const rowNode = node as SeatmapRowNode;
      remappedNodes[nodeId] = {
        ...rowNode,
        seatIds: rowNode.seatIds?.map((seatId) => seatIdMap.get(seatId) ?? seatId) ?? [],
      };
      return;
    }

    remappedNodes[nodeId] = {
      ...node,
      id: node.id ?? nodeId,
    } as SeatmapNode;
  });

  return {
    ...cloned,
    nodes: remappedNodes,
  };
};
