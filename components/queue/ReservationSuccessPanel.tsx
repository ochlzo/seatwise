"use client";

import * as React from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, RefreshCw, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { QueueStatePanel } from "@/components/queue/QueueStatePanel";
import { toast } from "@/components/ui/sonner";

interface ReservationSuccessPanelProps {
  showName: string;
  selectedSeatIds: string[];
  seatNumbersById: Record<string, string>;
  showId: string;
  contactEmail: string;
  reservationNumber: string | null;
}

export function ReservationSuccessPanel({
  showName,
  selectedSeatIds,
  seatNumbersById,
  showId,
  contactEmail,
  reservationNumber,
}: ReservationSuccessPanelProps) {
  const router = useRouter();
  const seatCount = selectedSeatIds.length;
  const seatLabel = seatCount === 1 ? "seat" : "seats";
  const [isResending, setIsResending] = React.useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = React.useState(0);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const resendWaitSeconds = Math.max(0, Math.ceil((resendCooldownUntil - now) / 1000));

  const handleBackToShow = () => {
    router.push(`/${showId}`);
  };

  const handleResendEmail = async () => {
    if (!contactEmail || !reservationNumber || isResending || resendWaitSeconds > 0) {
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch("/api/reservations/resend-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          showId,
          reservationNumber,
          email: contactEmail,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        cooldownUntil?: number;
      };

      if (!response.ok || !data.success) {
        if (typeof data.cooldownUntil === "number") {
          setResendCooldownUntil(data.cooldownUntil);
        }

        throw new Error(data.error || "Failed to resend reservation email.");
      }

      setResendCooldownUntil(data.cooldownUntil ?? Date.now() + 30_000);
      toast.success("Reservation email resent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend reservation email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <QueueStatePanel
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Reservation received"
          description={
            <div className="space-y-3 text-justify">
              Your {seatCount > 0 ? `${seatCount} ${seatLabel}` : "reservation"} for{" "}
              <span className="font-medium text-foreground">{showName}</span> has been received.
              We&apos;ll email updates to{" "}
              <span className="font-medium text-foreground">{contactEmail || "your email"}</span>.
            </div>
          }
          badgeLabel="All set"
          footer={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleBackToShow} className="sm:min-w-44">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to show
              </Button>
              <Button variant="outline" onClick={handleBackToShow} className="sm:min-w-44">
                Continue browsing
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-sidebar-border/70 bg-background/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Didn&apos;t get email?</p>
              <p className="text-xs text-muted-foreground">
                Request a fresh copy of your reservation receipt.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleResendEmail()}
              disabled={isResending || resendWaitSeconds > 0}
              className="sm:min-w-36"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : resendWaitSeconds > 0 ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend in {resendWaitSeconds}s
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-sidebar-border/70 bg-background/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Ticket className="h-3.5 w-3.5" />
                Seats
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">
                {seatCount > 0 ? seatCount : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-sidebar-border/70 bg-background/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Email
              </div>
              <div className="mt-2 truncate text-sm font-medium text-foreground">
                {contactEmail || "your email"}
              </div>
            </div>
            <div className="rounded-2xl border border-sidebar-border/70 bg-background/80 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Reference</div>
              <div className="mt-2 text-sm font-medium text-foreground">
                {reservationNumber || "Pending"}
              </div>
            </div>
          </div>

          {seatCount > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">Seats in this request</div>
              <div className="flex flex-wrap gap-2">
                {selectedSeatIds.map((seatId) => (
                  <div
                    key={seatId}
                    className="inline-flex items-center justify-center rounded-full border border-sidebar-border/70 bg-background px-3 py-1.5 text-xs font-semibold shadow-sm"
                  >
                    <span className="truncate">{seatNumbersById[seatId] ?? seatId}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-sm text-muted-foreground sm:text-base">
            If your payment is verified, the e-ticket will be sent to your email. You can safely leave this page now.
          </p>
        </QueueStatePanel>
      </div>
    </div>
  );
}
