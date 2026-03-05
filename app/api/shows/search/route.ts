import { NextRequest, NextResponse } from "next/server";
import { getShows } from "@/lib/db/Shows";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || undefined;
    const status = searchParams.get("status") || undefined;
    const statusGroup =
      searchParams.get("statusGroup") === "active" ? "active" : undefined;
    const visibility =
      searchParams.get("visibility") === "user" ? "user" : "admin";
    const sort = searchParams.get("sort") || undefined;
    const seatmapId = searchParams.get("seatmapId") || undefined;

    let adminScope:
      | {
          teamId: string | null;
          isSuperadmin: boolean;
        }
      | undefined;

    // Only admin-visibility queries require an authenticated admin session + scope.
    if (visibility !== "user") {
      try {
        const context = await getCurrentAdminContext();
        adminScope = {
          teamId: context.teamId,
          isSuperadmin: context.isSuperadmin,
        };
      } catch (error) {
        if (error instanceof AdminContextError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json(
          { error: "Unauthorized - Invalid session" },
          { status: 401 }
        );
      }
    }

    const shows = await getShows({
      query,
      status,
      statusGroup,
      visibility,
      sort,
      seatmapId,
      adminScope,
    });

    return NextResponse.json({ shows });
  } catch (error) {
    console.error("Error fetching shows:", error);
    return NextResponse.json(
      { error: "Failed to fetch shows" },
      { status: 500 }
    );
  }
}
