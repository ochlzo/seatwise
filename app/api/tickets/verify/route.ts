import { NextRequest, NextResponse } from "next/server";

import {
  AdminContextError,
  getCurrentAdminContext,
} from "@/lib/auth/adminContext";
import { normalizeScannedTicketToken } from "@/lib/tickets/qrPayload";
import {
  verifyScannedIssuedTicket,
} from "@/lib/tickets/verifyScannedIssuedTicket";
import { TicketConsumeAuthorizationError } from "@/lib/tickets/consumeIssuedTicket";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

type VerifyTicketRequestBody = {
  token?: string;
  showId?: string;
  schedId?: string;
};

const normalize = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function POST(request: NextRequest) {
  try {
    let adminContext;
    try {
      adminContext = await getCurrentAdminContext();
    } catch (error) {
      if (error instanceof AdminContextError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as VerifyTicketRequestBody;
    const token = normalizeScannedTicketToken(normalize(body.token));
    const showId = normalize(body.showId);
    const schedId = normalize(body.schedId);

    if (!token || !showId || !schedId) {
      return NextResponse.json(
        { error: "Missing token, showId, or schedId." },
        { status: 400 },
      );
    }

    const result = await verifyScannedIssuedTicket({
      token,
      showId,
      schedId,
      adminContext,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TicketConsumeAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[tickets/verify] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
