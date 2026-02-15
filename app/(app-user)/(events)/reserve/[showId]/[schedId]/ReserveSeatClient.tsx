"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type StoredActiveSession = {
  ticketId: string;
  activeToken: string;
  expiresAt: number;
  showScopeId: string;
};

type ActiveValidationResponse = {
  success: boolean;
  valid?: boolean;
  error?: string;
  showName?: string;
  session?: {
    ticketId: string;
    activeToken: string;
    expiresAt: number;
    startedAt: number;
    userId: string;
  };
};

type ReserveSeatClientProps = {
  showId: string;
  schedId: string;
};

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getStoredSession = (showScopeId: string): StoredActiveSession | null => {
  if (typeof window === "undefined") return null;

  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i);
    if (!key || !key.startsWith(`seatwise:active:${showScopeId}:`)) {
      continue;
    }

    const raw = window.sessionStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as StoredActiveSession;
      if (parsed.showScopeId === showScopeId && parsed.ticketId && parsed.activeToken) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
};

const clearStoredSession = (showScopeId: string) => {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i);
    if (key?.startsWith(`seatwise:active:${showScopeId}:`)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
};

export function ReserveSeatClient({ showId, schedId }: ReserveSeatClientProps) {
  const router = useRouter();
  const showScopeId = `${showId}:${schedId}`;
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showName, setShowName] = React.useState<string>("");
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  const [now, setNow] = React.useState<number>(0);

  React.useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const verify = async () => {
      setIsLoading(true);
      setError(null);

      const stored = getStoredSession(showScopeId);
      if (!stored) {
        setError("No active queue session found. Join the queue first.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/queue/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId,
            schedId,
            ticketId: stored.ticketId,
            activeToken: stored.activeToken,
          }),
        });

        const data = (await response.json()) as ActiveValidationResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to validate active session");
        }

        if (!data.valid || !data.session) {
          clearStoredSession(showScopeId);
          setError("Your active reservation window has expired. Rejoin the queue.");
          setIsLoading(false);
          return;
        }

        setShowName(data.showName || "");
        setExpiresAt(data.session.expiresAt);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to validate active session");
        setIsLoading(false);
      }
    };

    void verify();
  }, [schedId, showId, showScopeId]);

  React.useEffect(() => {
    if (!expiresAt) return;
    if (expiresAt <= now) {
      clearStoredSession(showScopeId);
      setError("Your active reservation window has expired. Rejoin the queue.");
    }
  }, [expiresAt, now, showScopeId]);

  const goToQueue = () => {
    router.push(`/queue/${showId}/${schedId}`);
  };

  const handleDoneReserving = async () => {
    const stored = getStoredSession(showScopeId);
    if (!stored) {
      setError("No active queue session found. Join the queue first.");
      return;
    }

    setIsCompleting(true);
    try {
      const response = await fetch("/api/queue/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          schedId,
          ticketId: stored.ticketId,
          activeToken: stored.activeToken,
        }),
      });

      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to complete reservation session");
      }

      clearStoredSession(showScopeId);
      router.push(`/queue/${showId}/${schedId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete reservation session");
    } finally {
      setIsCompleting(false);
    }
  };

  const remaining = expiresAt ? expiresAt - now : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Active Reservation Session
          </CardTitle>
          <CardDescription>
            {showName || "Validating your queue access token..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying active session...
            </div>
          )}

          {!isLoading && error && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
              <Button variant="outline" onClick={goToQueue}>
                Back to queue
              </Button>
            </div>
          )}

          {!isLoading && !error && expiresAt && (
            <div className="space-y-4">
              <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                  <Clock3 className="h-4 w-4" />
                  Active window: {formatDuration(remaining)}
                </div>
              </div>

              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                Seat reservation canvas should render here. Keep all booking API calls fenced by
                the same queue `ticketId + activeToken` pair.
              </div>

              <Button onClick={handleDoneReserving} disabled={isCompleting} className="w-fit">
                {isCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCompleting ? "Completing..." : "Done reserving (simulate)"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
