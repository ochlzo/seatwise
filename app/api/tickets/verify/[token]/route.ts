import { NextRequest, NextResponse } from "next/server";

import { verifyIssuedTicket } from "@/lib/tickets/verifyIssuedTicket";

type VerifyRouteParams = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: NextRequest, { params }: VerifyRouteParams) {
  try {
    const { token } = await params;
    const result = await verifyIssuedTicket(token);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[tickets/verify] Error:", error);
    return NextResponse.json(
      {
        status: "INVALID",
        reason: "INVALID_TOKEN",
        message: "Ticket verification failed.",
      },
      { status: 500 },
    );
  }
}
