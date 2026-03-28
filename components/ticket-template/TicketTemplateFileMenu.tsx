"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { resolveTicketTemplateAssetRefsForSave } from "@/lib/clients/cloudinary-upload";
import { saveTicketTemplateAction } from "@/lib/actions/saveTicketTemplate";
import {
  deleteSelectedNode,
  duplicateSelectedNode,
  loadTicketTemplate,
  redo,
  resetTicketTemplate,
  serializeTicketTemplateEditor,
  undo,
} from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { cn } from "@/lib/utils";

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function TicketTemplateFileMenu() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const ticketTemplateState = useAppSelector((state) => state.ticketTemplate);
  const hasSelection = Boolean(ticketTemplateState.selectedNodeId);
  const hasUndo = ticketTemplateState.history.past.length > 0;
  const hasRedo = ticketTemplateState.history.future.length > 0;
  const [isSavingTemplate, setIsSavingTemplate] = React.useState(false);
  const uploadKeyRef = React.useRef(
    `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const exportEditorJson = React.useCallback(() => {
    const payload = {
      title: ticketTemplateState.title,
      ticketTemplateId: ticketTemplateState.ticketTemplateId,
      loadedVersionId: ticketTemplateState.loadedVersionId,
      template: serializeTicketTemplateEditor(ticketTemplateState),
      editorNodes: ticketTemplateState.nodes,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(ticketTemplateState.title) || "ticket-template"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [ticketTemplateState]);

  const exportPreviewPng = React.useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("ticket-template-export-png", {
        detail: {
          fileName: `${slugify(ticketTemplateState.title) || "ticket-template"}.png`,
        },
      }),
    );
  }, [ticketTemplateState.title]);

  const createBlankTemplate = React.useCallback(() => {
    dispatch(resetTicketTemplate());
    router.push("/ticket-builder");
  }, [dispatch, router]);

  const saveTemplate = React.useCallback(async () => {
    const templateName = ticketTemplateState.title.trim();
    if (!templateName) {
      toast.error("Template name is required.");
      return;
    }

    setIsSavingTemplate(true);

    try {
      const templateSchema = await resolveTicketTemplateAssetRefsForSave(
        serializeTicketTemplateEditor(ticketTemplateState),
        {
          ticketTemplateId: ticketTemplateState.ticketTemplateId,
          uploadKey: uploadKeyRef.current,
        },
      );

      const result = await saveTicketTemplateAction({
        ticketTemplateId: ticketTemplateState.ticketTemplateId ?? undefined,
        templateName,
        templateSchema,
      });

      if (!result.success || !result.ticketTemplateId || !result.ticketTemplateVersionId) {
        throw new Error(result.error || "Failed to save ticket template.");
      }

      dispatch(
        loadTicketTemplate({
          ticketTemplateId: result.ticketTemplateId,
          loadedVersionId: result.ticketTemplateVersionId,
          title: templateName,
          template: templateSchema,
        }),
      );

      router.replace(`/ticket-builder?ticketTemplateId=${result.ticketTemplateId}`);
      toast.success(
        result.versionNumber === 1
          ? "Saved template version 1."
          : `Saved template version ${result.versionNumber}.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save ticket template.";
      toast.error(message);
    } finally {
      setIsSavingTemplate(false);
    }
  }, [dispatch, router, ticketTemplateState]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-2 border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800",
          )}
        >
          File
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuItem onClick={createBlankTemplate} className="gap-2">
          <FilePlus2 className="h-4 w-4 text-emerald-600" />
          New Blank Template
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="gap-2">
          <Link href="/admin/ticket-templates">
            <FolderOpen className="h-4 w-4 text-blue-600" />
            Open Templates List
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => dispatch(undo())}
          disabled={!hasUndo}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4 text-violet-600" />
          Undo
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => dispatch(redo())}
          disabled={!hasRedo}
          className="gap-2"
        >
          <RotateCw className="h-4 w-4 text-violet-600" />
          Redo
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => dispatch(duplicateSelectedNode())}
          disabled={!hasSelection}
          className="gap-2"
        >
          <Copy className="h-4 w-4 text-amber-600" />
          Duplicate Selection
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => dispatch(deleteSelectedNode())}
          disabled={!hasSelection}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4 text-rose-600" />
          Delete Selection
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => void saveTemplate()}
          disabled={isSavingTemplate}
          className="gap-2"
        >
          <Save className="h-4 w-4 text-emerald-600" />
          {isSavingTemplate ? "Saving Template..." : "Save Template"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={exportEditorJson} className="gap-2">
          <Download className="h-4 w-4 text-blue-600" />
          Export Editor JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPreviewPng} className="gap-2">
          <Download className="h-4 w-4 text-emerald-600" />
          Export Preview PNG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
