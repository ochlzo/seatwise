"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Download,
  FilePlus2,
  FolderOpen,
  Loader2,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  loadTicketTemplate,
  resetTicketTemplate,
  serializeTicketTemplateEditor,
} from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { cn } from "@/lib/utils";

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function TicketTemplateFileMenu({
  selectedTeamId,
  availableVersions,
  liveVersionId,
}: {
  selectedTeamId?: string | null;
  availableVersions?: Array<{
    ticket_template_version_id: string;
    version_number: number;
    createdAt: string;
  }>;
  liveVersionId?: string | null;
}) {
  const triggerId = "ticket-template-file-menu-trigger";
  const router = useRouter();
  const dispatch = useAppDispatch();
  const ticketTemplateState = useAppSelector((state) => state.ticketTemplate);
  const [isSavingTemplate, setIsSavingTemplate] = React.useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const uploadKeyRef = React.useRef(
    `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const saveTargets = React.useMemo(() => {
    if ((availableVersions?.length ?? 0) > 0) {
      return (availableVersions ?? []).map((version) => ({
        value: version.ticket_template_version_id,
        label:
          version.ticket_template_version_id === liveVersionId
            ? `v${version.version_number} (Live)`
            : `v${version.version_number}`,
      }));
    }

    return [
      {
        value: "__create_v1__",
        label: "v1 (Live)",
      },
    ];
  }, [availableVersions, liveVersionId]);
  const [targetVersionId, setTargetVersionId] = React.useState<string>(
    saveTargets[0]?.value ?? "__create_v1__",
  );

  React.useEffect(() => {
    const currentVersionId = ticketTemplateState.loadedVersionId;
    const defaultTarget =
      saveTargets.find((target) => target.value === currentVersionId)?.value ??
      saveTargets[0]?.value ??
      "__create_v1__";
    setTargetVersionId(defaultTarget);
  }, [saveTargets, ticketTemplateState.loadedVersionId]);

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

  const capturePreviewPngDataUrl = React.useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      let settled = false;

      const timeout = window.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        reject(new Error("Timed out while capturing the ticket preview image."));
      }, 3000);

      window.dispatchEvent(
        new CustomEvent("ticket-template-capture-png", {
          detail: {
            onCaptured: (dataUrl: string | null) => {
              if (settled) {
                return;
              }

              settled = true;
              window.clearTimeout(timeout);

              if (!dataUrl) {
                reject(new Error("Failed to capture the ticket preview image."));
                return;
              }

              resolve(dataUrl);
            },
          },
        }),
      );
    });
  }, []);

  const saveTemplate = React.useCallback(async () => {
    const templateName = ticketTemplateState.title.trim();
    if (!templateName) {
      toast.error("Template name is required.");
      return;
    }

    setIsSavingTemplate(true);

    try {
      const previewDataUrl = await capturePreviewPngDataUrl();
      const templateSchema = await resolveTicketTemplateAssetRefsForSave(
        serializeTicketTemplateEditor(ticketTemplateState),
        {
          ticketTemplateId: ticketTemplateState.ticketTemplateId,
          uploadKey: uploadKeyRef.current,
          previewDataUrl,
        },
      );

      const result = await saveTicketTemplateAction({
        ticketTemplateId: ticketTemplateState.ticketTemplateId ?? undefined,
        ticketTemplateVersionId:
          targetVersionId === "__create_v1__" ? undefined : targetVersionId,
        teamId: selectedTeamId ?? undefined,
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

      router.replace(
        `/ticket-builder?ticketTemplateId=${result.ticketTemplateId}&ticketTemplateVersionId=${result.ticketTemplateVersionId}`,
      );
      setIsSaveDialogOpen(false);
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
  }, [
    capturePreviewPngDataUrl,
    dispatch,
    router,
    selectedTeamId,
    targetVersionId,
    ticketTemplateState,
  ]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild id={triggerId}>
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
          onClick={() => setIsSaveDialogOpen(true)}
          disabled={isSavingTemplate}
          className="gap-2"
        >
          <Save className="h-4 w-4 text-emerald-600" />
          Save Template
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
      <Dialog
        open={isSaveDialogOpen}
        onOpenChange={(open) => {
          if (isSavingTemplate) {
            return;
          }
          setIsSaveDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Save</DialogTitle>
            <DialogDescription>
              Choose which version to save into. This will not change the live version used for reservations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label
              htmlFor="ticket-template-save-version"
              className="text-sm font-medium text-foreground"
            >
              Save target
            </label>
            <select
              id="ticket-template-save-version"
              value={targetVersionId}
              onChange={(event) => setTargetVersionId(event.target.value)}
              disabled={isSavingTemplate}
              className="border-input h-10 w-full rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {saveTargets.map((target) => (
                <option key={target.value} value={target.value}>
                  {target.label}
                </option>
              ))}
            </select>
            {isSavingTemplate ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving template...
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
              disabled={isSavingTemplate}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveTemplate()}
              disabled={isSavingTemplate}
            >
              {isSavingTemplate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}
