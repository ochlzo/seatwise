"use client";

import { CheckCircle2, Mail, Ticket, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { QueueStatePanel } from "@/components/queue/QueueStatePanel";

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

  const handleBackToShow = () => {
    router.push(`/${showId}`);
  };

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <QueueStatePanel
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Reservation received"
          description={
            <>
              Your {seatCount > 0 ? `${seatCount} ${seatLabel}` : "reservation"} for{" "}
              <span className="font-medium text-foreground">{showName}</span> has been received.
              We&apos;ll email updates to{" "}
              <span className="font-medium text-foreground">{contactEmail || "your email"}</span>.
            </>
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
