import { NextRequest, NextResponse } from "next/server";

import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { getTicketTemplates } from "@/lib/db/TicketTemplates";

export async function GET(request: NextRequest) {
  try {
    const adminContext = await getCurrentAdminContext();
    const searchParams = request.nextUrl.searchParams;

    const ticketTemplates = await getTicketTemplates({
      adminScope: {
        teamId: adminContext.teamId,
        isSuperadmin: adminContext.isSuperadmin,
      },
      query: searchParams.get("q") || undefined,
      sort: searchParams.get("sort") || undefined,
      teamId: searchParams.get("teamId") || undefined,
    });

    return NextResponse.json({
      success: true,
      ticketTemplates,
    });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[ticket-templates][GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticket templates." },
      { status: 500 },
    );
  }
}
