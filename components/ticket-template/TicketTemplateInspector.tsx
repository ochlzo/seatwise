"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateNode } from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

function NumericInput({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (nextValue: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onCommit(Number(event.target.value))}
      />
    </div>
  );
}

export function TicketTemplateInspector() {
  const dispatch = useAppDispatch();
  const selectedNode = useAppSelector((state) =>
    state.ticketTemplate.nodes.find(
      (node) => node.id === state.ticketTemplate.selectedNodeId,
    ),
  );

  const updateSelectedNode = React.useCallback(
    (changes: Record<string, unknown>) => {
      if (!selectedNode) {
        return;
      }

      dispatch(
        updateNode({
          id: selectedNode.id,
          changes,
        }),
      );
    },
    [dispatch, selectedNode],
  );

  return (
    <Card className="gap-4 border-zinc-200/80 bg-white/90 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <SlidersHorizontal className="h-4 w-4 text-amber-600" />
          Inspector
        </CardTitle>
        <CardDescription>
          Fine-tune the selected element without changing the fixed canvas size.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-4">
        {!selectedNode ? (
          <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Select an element on the canvas or in the layer stack to edit its properties.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <NumericInput
                id="ticket-node-x"
                label="X"
                value={selectedNode.x}
                onCommit={(nextValue) => updateSelectedNode({ x: nextValue })}
              />
              <NumericInput
                id="ticket-node-y"
                label="Y"
                value={selectedNode.y}
                onCommit={(nextValue) => updateSelectedNode({ y: nextValue })}
              />
            </div>

            <NumericInput
              id="ticket-node-opacity"
              label="Opacity"
              value={selectedNode.opacity}
              min={0}
              max={1}
              step={0.05}
              onCommit={(nextValue) =>
                updateSelectedNode({ opacity: Math.min(1, Math.max(0, nextValue)) })
              }
            />

            {selectedNode.kind === "asset" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <NumericInput
                    id="ticket-asset-width"
                    label="Width"
                    value={selectedNode.width}
                    min={24}
                    onCommit={(nextValue) => updateSelectedNode({ width: nextValue })}
                  />
                  <NumericInput
                    id="ticket-asset-height"
                    label="Height"
                    value={selectedNode.height}
                    min={24}
                    onCommit={(nextValue) => updateSelectedNode({ height: nextValue })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ticket-asset-name">Asset Name</Label>
                  <Input
                    id="ticket-asset-name"
                    value={selectedNode.name ?? ""}
                    readOnly
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ticket-asset-ref">Cloudinary Ref</Label>
                  <Input
                    id="ticket-asset-ref"
                    value={selectedNode.assetKey ?? ""}
                    readOnly
                  />
                </div>
              </>
            ) : null}

            {selectedNode.kind === "field" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="ticket-field-label">Display Label</Label>
                  <Input
                    id="ticket-field-label"
                    value={selectedNode.label}
                    onChange={(event) =>
                      updateSelectedNode({ label: event.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <NumericInput
                    id="ticket-field-width"
                    label="Text Width"
                    value={selectedNode.width}
                    min={80}
                    onCommit={(nextValue) => updateSelectedNode({ width: nextValue })}
                  />
                  <NumericInput
                    id="ticket-field-size"
                    label="Font Size"
                    value={selectedNode.fontSize}
                    min={12}
                    onCommit={(nextValue) =>
                      updateSelectedNode({ fontSize: nextValue })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <NumericInput
                    id="ticket-field-weight"
                    label="Font Weight"
                    value={selectedNode.fontWeight}
                    min={100}
                    max={900}
                    step={100}
                    onCommit={(nextValue) =>
                      updateSelectedNode({ fontWeight: nextValue })
                    }
                  />

                  <div className="grid gap-2">
                    <Label htmlFor="ticket-field-align">Alignment</Label>
                    <Select
                      value={selectedNode.align}
                      onValueChange={(nextValue) =>
                        updateSelectedNode({ align: nextValue })
                      }
                    >
                      <SelectTrigger id="ticket-field-align" className="w-full">
                        <SelectValue placeholder="Choose alignment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ticket-field-color">Text Color</Label>
                  <Input
                    id="ticket-field-color"
                    type="color"
                    value={selectedNode.fill}
                    onChange={(event) =>
                      updateSelectedNode({ fill: event.target.value })
                    }
                    className="h-10 w-full cursor-pointer"
                  />
                </div>
              </>
            ) : null}

            {selectedNode.kind === "qr" ? (
              <NumericInput
                id="ticket-qr-size"
                label="QR Size"
                value={selectedNode.size}
                min={48}
                onCommit={(nextValue) => updateSelectedNode({ size: nextValue })}
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
