"use client";

import React from "react";
import { Group, Line } from "react-konva";
import { useAppSelector } from "@/lib/hooks";
import { GuidePathNode } from "@/lib/seatmap/types";

export default function GuidePathLayer() {
  const nodes = useAppSelector((state) => state.seatmap.nodes);
  const showGuidePaths = useAppSelector((state) => state.seatmap.showGuidePaths);

  if (!showGuidePaths) return null;

  const guides = Object.values(nodes).filter(
    (node): node is GuidePathNode =>
      node.type === "helper" && node.helperType === "guidePath",
  );

  if (!guides.length) return null;

  return (
    <Group listening={false}>
      {guides.map((guide) => (
        <Line
          key={guide.id}
          points={guide.points}
          stroke={guide.stroke ?? "#9ca3af"}
          strokeWidth={guide.strokeWidth ?? 2}
          dash={guide.dash ?? [6, 4]}
          lineCap="round"
          lineJoin="round"
          listening={false}
          strokeScaleEnabled={false}
        />
      ))}
    </Group>
  );
}
