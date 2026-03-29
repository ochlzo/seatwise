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
import { TICKET_TEMPLATE_FONT_OPTIONS } from "@/lib/tickets/fontCatalog";

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
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[11px] leading-4">{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        className="h-8 text-xs"
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

  const hasSelectedFontInCatalog =
    selectedNode?.kind === "field"
      ? TICKET_TEMPLATE_FONT_OPTIONS.some(
          (option) => option.family === selectedNode.fontFamily,
        )
      : true;

  return (
    <Card className="min-w-0 gap-3 overflow-hidden border-zinc-200/80 bg-white/90 py-3 dark:border-zinc-800 dark:bg-zinc-950/80">
      <CardHeader className="px-3">
        <CardTitle className="flex items-center gap-2 text-xs">
          <SlidersHorizontal className="h-4 w-4 text-amber-600" />
          Inspector
        </CardTitle>
        <CardDescription className="text-[11px] leading-4 break-words">
          Fine-tune the selected element without changing the fixed canvas size.
        </CardDescription>
      </CardHeader>

      <CardContent className="min-w-0 space-y-3 overflow-x-hidden px-3">
        {!selectedNode ? (
          <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-3 text-xs leading-4 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
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
                  <Label htmlFor="ticket-asset-name" className="text-[11px] leading-4">Asset Name</Label>
                  <Input
                    id="ticket-asset-name"
                    value={selectedNode.name ?? ""}
                    className="h-8 text-xs"
                    readOnly
                  />
                </div>

              </>
            ) : null}

            {selectedNode.kind === "field" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="ticket-field-label" className="text-[11px] leading-4">Display Label</Label>
                  <Input
                    id="ticket-field-label"
                    value={selectedNode.label}
                    className="h-8 text-xs"
                    onChange={(event) =>
                      updateSelectedNode({ label: event.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ticket-field-font-family" className="text-[11px] leading-4">Font Family</Label>
                  <Select
                    value={selectedNode.fontFamily}
                    onValueChange={(nextValue) =>
                      updateSelectedNode({ fontFamily: nextValue })
                    }
                  >
                    <SelectTrigger id="ticket-field-font-family" className="h-8 w-full text-xs">
                      <SelectValue placeholder="Choose font family" />
                    </SelectTrigger>
                    <SelectContent>
                      {!hasSelectedFontInCatalog ? (
                        <SelectItem value={selectedNode.fontFamily}>
                          <span style={{ fontFamily: selectedNode.fontFamily }}>
                            {selectedNode.fontFamily}
                          </span>
                        </SelectItem>
                      ) : null}
                      {TICKET_TEMPLATE_FONT_OPTIONS.map((option) => (
                        <SelectItem key={option.family} value={option.family}>
                          <span style={{ fontFamily: option.family }}>{option.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    id="ticket-field-height"
                    label="Text Height"
                    value={selectedNode.height}
                    min={24}
                    onCommit={(nextValue) => updateSelectedNode({ height: nextValue })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <NumericInput
                    id="ticket-field-size"
                    label="Font Size"
                    value={selectedNode.fontSize}
                    min={12}
                    onCommit={(nextValue) =>
                      updateSelectedNode({ fontSize: nextValue })
                    }
                  />
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
                    <Label htmlFor="ticket-field-align" className="text-[11px] leading-4">Alignment</Label>
                    <Select
                      value={selectedNode.align}
                      onValueChange={(nextValue) =>
                        updateSelectedNode({ align: nextValue })
                      }
                    >
                      <SelectTrigger id="ticket-field-align" className="h-8 w-full text-xs">
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
                  <Label htmlFor="ticket-field-color" className="text-[11px] leading-4">Text Color</Label>
                  <Input
                    id="ticket-field-color"
                    type="color"
                    value={selectedNode.fill}
                    onChange={(event) =>
                      updateSelectedNode({ fill: event.target.value })
                    }
                    className="h-8 w-full cursor-pointer"
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
