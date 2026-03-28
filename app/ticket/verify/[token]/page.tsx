"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { TicketVerificationResult } from "@/components/tickets/TicketVerificationResult";
import type { TicketVerificationResult as TicketVerificationResultData } from "@/lib/tickets/verifyIssuedTicket";

export default function TicketVerifyPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [isLoading, setIsLoading] = React.useState(true);
  const [result, setResult] = React.useState<TicketVerificationResultData | null>(
    null,
  );

  const loadVerification = React.useEffectEvent(async (tokenValue: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/tickets/verify/${encodeURIComponent(tokenValue)}`,
        {
          cache: "no-store",
        },
      );

      const data = (await response.json()) as TicketVerificationResultData;
      setResult(
        response.ok
          ? data
          : {
              status: "INVALID",
              reason: "INVALID_TOKEN",
              message: "Ticket verification failed.",
            },
      );
    } catch {
      setResult({
        status: "INVALID",
        reason: "INVALID_TOKEN",
        message: "Ticket verification failed.",
      });
    } finally {
      setIsLoading(false);
    }
  });

  React.useEffect(() => {
    if (!token) {
      setResult({
        status: "INVALID",
        reason: "INVALID_TOKEN",
        message: "Ticket token is missing.",
      });
      setIsLoading(false);
      return;
    }

    void loadVerification(token);
  }, [token]);

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Seatwise
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Ticket Verification
          </h1>
          <p className="text-sm text-muted-foreground">
            This page checks the signed QR token and shows a public-safe ticket
            status only.
          </p>
        </div>

        <TicketVerificationResult
          result={result}
          loading={isLoading}
          title="Verification Result"
          description="A fresh ticket shows VALID. A used ticket still resolves and shows CONSUMED."
          emptyMessage="Open a ticket verification link to view its status."
        />
      </div>
    </main>
  );
}
