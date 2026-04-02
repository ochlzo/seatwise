"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { QueueStatePanel } from "@/components/queue/QueueStatePanel";
import { getJoinTransitionState } from "@/lib/queue/joinTransition";

export default function ReserveSeatLoading() {
  const params = useParams<{ showId: string; schedId: string }>();

  React.useEffect(() => {
    if (!params.showId || !params.schedId) return;

    const showScopeId = `${params.showId}:${params.schedId}`;
    void getJoinTransitionState(showScopeId);
  }, [params.schedId, params.showId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6 lg:p-8">
      <QueueStatePanel
        tone="neutral"
        icon={<Sparkles className="h-5 w-5" />}
        title="Getting your seats ready"
        description="Please keep this tab open while we bring you into the reservation room."
        badgeLabel="Please wait"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Securing your place...
        </div>
      </QueueStatePanel>
    </div>
  );
}
