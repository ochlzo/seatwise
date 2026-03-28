import { NextRequest, NextResponse } from "next/server";

import {
  AdminContextError,
  getCurrentAdminContext,
} from "@/lib/auth/adminContext";
import {
  consumeIssuedTicket,
  TicketConsumeAuthorizationError,
} from "@/lib/tickets/consumeIssuedTicket";
import { normalizeScannedTicketToken } from "@/lib/tickets/qrPayload";

type ConsumeTicketRequestBody = {
  token?: string;
  showId?: string;
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

    const body = (await request.json()) as ConsumeTicketRequestBody;
    const token = normalizeScannedTicketToken(normalize(body.token));
    const showId = normalize(body.showId);

    if (!token || !showId) {
      return NextResponse.json(
        { error: "Missing token or showId." },
        { status: 400 },
      );
    }

    const result = await consumeIssuedTicket({
      token,
      showId,
      adminContext,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TicketConsumeAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[tickets/consume] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
