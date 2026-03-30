"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getJoinTransitionState } from "@/lib/queue/joinTransition";

export default function ReserveSeatLoading() {
  const params = useParams<{ showId: string; schedId: string }>();
  const [message, setMessage] = React.useState("Loading reservation room...");

  React.useEffect(() => {
      if (!params.showId || !params.schedId) return;

      const showScopeId = `${params.showId}:${params.schedId}`;
      const transition = getJoinTransitionState(showScopeId);
      if (!transition) return;
      setMessage("Joining queue...");
  }, [params.schedId, params.showId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6 lg:p-8">
      <Card className="rounded-none border-0 bg-transparent py-0 shadow-none sm:rounded-xl sm:border-sidebar-border/70 sm:bg-card sm:py-6 sm:shadow-sm">
        <CardContent className="px-0 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {message}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
