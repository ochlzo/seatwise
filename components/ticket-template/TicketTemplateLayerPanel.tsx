"use client";

import { ArrowDown, ArrowUp, Layers3, MousePointer2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  moveAssetLayer,
  selectNode,
  toggleNodeInSelection,
} from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const KIND_LABELS = {
  asset: "Artwork",
  field: "Field",
  qr: "QR",
} as const;

export function TicketTemplateLayerPanel() {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((state) => state.ticketTemplate.nodes);
  const selectedNodeIds = useAppSelector(
    (state) => state.ticketTemplate.selectedNodeIds,
  );

  const orderedNodes = [...nodes].reverse();

  return (
    <Card className="min-w-0 gap-3 overflow-hidden border-zinc-200/80 bg-white/90 py-3 dark:border-zinc-800 dark:bg-zinc-950/80">
      <CardHeader className="px-3">
        <CardTitle className="flex items-center gap-2 text-xs">
          <Layers3 className="h-4 w-4 text-violet-600" />
          Layer Stack
        </CardTitle>
        <CardDescription className="text-[11px] leading-4 break-words">
          Overlay content stays above artwork even while you drag it around.
        </CardDescription>
      </CardHeader>

      <CardContent className="min-w-0 space-y-2 overflow-x-hidden px-3">
        {orderedNodes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-3 text-xs leading-4 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Add an artwork block, dynamic field, or QR node to start composing the ticket.
          </div>
        ) : (
          orderedNodes.map((node) => {
            const selected = selectedNodeIds.includes(node.id);
            const assetIndex = nodes.filter((item) => item.kind === "asset").findIndex(
              (item) => item.id === node.id,
            );
            const assetCount = nodes.filter((item) => item.kind === "asset").length;
            const canMoveDown = node.kind === "asset" && assetIndex > 0;
            const canMoveUp =
              node.kind === "asset" && assetIndex !== -1 && assetIndex < assetCount - 1;

            return (
              <div
                key={node.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                  selected
                    ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                    : "border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  onClick={(event) => {
                    if (event.shiftKey || event.ctrlKey || event.metaKey) {
                      dispatch(toggleNodeInSelection(node.id));
                      return;
                    }

                    dispatch(selectNode(node.id));
                  }}
                >
                  <MousePointer2 className="h-4 w-4 shrink-0 text-zinc-400" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">
                      {node.kind === "field"
                        ? node.label
                        : node.kind === "asset"
                          ? node.name ?? "PNG Asset"
                          : "QR Code"}
                    </div>
                    <div className="truncate text-[10px] text-zinc-500">
                      {node.kind === "field"
                        ? node.fieldKey
                        : node.kind === "asset"
                          ? `${Math.round(node.width)} x ${Math.round(node.height)}`
                          : `${Math.round(node.size)} px`}
                    </div>
                  </div>
                </button>

                <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                  {KIND_LABELS[node.kind]}
                </Badge>

                {node.kind === "asset" ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        dispatch(moveAssetLayer({ id: node.id, direction: "up" }))
                      }
                      disabled={!canMoveUp}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        dispatch(moveAssetLayer({ id: node.id, direction: "down" }))
                      }
                      disabled={!canMoveDown}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
