import { NextResponse } from "next/server";
import { getShowTicketDesigns } from "@/lib/tickets/getShowTicketDesigns";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ showId: string }> },
) {
  try {
    const { showId } = await params;
    const designs = await getShowTicketDesigns(showId);

    return NextResponse.json({
      success: true,
      designs,
    });
  } catch (error) {
    console.error("[shows/:showId/ticket-designs][GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load ticket designs." },
      { status: 500 },
    );
  }
}
