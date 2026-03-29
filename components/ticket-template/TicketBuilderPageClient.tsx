"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import LoadingPage from "@/app/LoadingPage";
import { TicketTemplateControlBar } from "@/components/ticket-template/TicketTemplateControlBar";
import { TicketTemplateFileMenu } from "@/components/ticket-template/TicketTemplateFileMenu";
import { TicketTemplateInspector } from "@/components/ticket-template/TicketTemplateInspector";
import { TicketTemplateLayerPanel } from "@/components/ticket-template/TicketTemplateLayerPanel";
import { TicketTemplatePageHeader } from "@/components/ticket-template/ticket-template-page-header";
import { TicketTemplateTeamSelector } from "@/components/ticket-template/TicketTemplateTeamSelector";
import { TicketTemplateSidebar } from "@/components/ticket-template/ticket-template-sidebar";
import { TicketTemplateTitle } from "@/components/ticket-template/TicketTemplateTitle";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { toast } from "@/components/ui/sonner";
import {
  loadTicketTemplate,
  resetTicketTemplate,
} from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

const TicketTemplateCanvas = dynamic(
  () =>
    import("@/components/ticket-template/TicketTemplateCanvas").then(
      (module) => module.TicketTemplateCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        Loading ticket canvas...
      </div>
    ),
  },
);

export function TicketBuilderPageClient() {
  const searchParams = useSearchParams();
  const ticketTemplateId = searchParams.get("ticketTemplateId");
  const dispatch = useAppDispatch();
  const hasUnsavedChanges = useAppSelector(
    (state) => state.ticketTemplate.hasUnsavedChanges,
  );
  const [isLoadingTemplate, setIsLoadingTemplate] = React.useState(false);
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const loadTemplate = async () => {
      if (!ticketTemplateId) {
        dispatch(resetTicketTemplate());
        return;
      }

      try {
        setIsLoadingTemplate(true);
        const response = await fetch(`/api/ticket-templates/${ticketTemplateId}`);

        if (!response.ok) {
          throw new Error("Failed to load ticket template.");
        }

        const data = await response.json();

        if (!isMounted) {
          return;
        }

        dispatch(
          loadTicketTemplate({
            ticketTemplateId: data.ticketTemplate.ticket_template_id,
            loadedVersionId:
              data.ticketTemplate.latestVersion?.ticket_template_version_id ?? null,
            title: data.ticketTemplate.template_name,
            template: data.ticketTemplate.latestVersion?.template_schema,
          }),
        );
        setSelectedTeamId(data.ticketTemplate.team_id ?? null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load ticket template.";
        toast.error(message);
        dispatch(resetTicketTemplate());
      } finally {
        if (isMounted) {
          setIsLoadingTemplate(false);
        }
      }
    };

    loadTemplate();

    return () => {
      isMounted = false;
    };
  }, [dispatch, ticketTemplateId]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
      suppressHydrationWarning
    >
      <LoadingPage />
      <TicketTemplateSidebar />

      <SidebarInset className="overflow-hidden">
        <TicketTemplatePageHeader
          rightSlot={
            <div className="flex items-center gap-2">
              <ThemeSwithcer />
              <TicketTemplateTitle />
              <TicketTemplateTeamSelector
                selectedTeamId={selectedTeamId}
                onSelectedTeamIdChange={setSelectedTeamId}
                className="w-[220px] border-zinc-200 dark:border-zinc-800 bg-background"
              />
              <TicketTemplateFileMenu selectedTeamId={selectedTeamId} />
            </div>
          }
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="relative min-h-0 overflow-hidden border-b border-zinc-200 xl:border-r xl:border-b-0 dark:border-zinc-800">
            {isLoadingTemplate ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-zinc-950/70">
                <div className="flex flex-col items-center gap-3 text-zinc-700 dark:text-zinc-200">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-200" />
                  <span className="text-sm font-medium">
                    Loading ticket template...
                  </span>
                </div>
              </div>
            ) : null}
            <TicketTemplateCanvas />
            <TicketTemplateControlBar />
          </div>

          <div className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-zinc-50/80 p-3 dark:bg-zinc-950">
            <div className="grid min-w-0 gap-3">
              <TicketTemplateLayerPanel />
              <TicketTemplateInspector />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
