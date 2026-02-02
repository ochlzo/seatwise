import { NextRequest, NextResponse } from "next/server";
import { getShows } from "@/lib/db/Shows";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest) {
  try {
    // Verify user session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Unauthorized - No session found" },
        { status: 401 }
      );
    }

    try {
      await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch {
      return NextResponse.json(
        { error: "Unauthorized - Invalid session" },
        { status: 401 }
      );
    }

    // Fetch shows
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || undefined;
    const status = searchParams.get("status") || undefined;
    const statusGroup =
      searchParams.get("statusGroup") === "active" ? "active" : undefined;
    const sort = searchParams.get("sort") || undefined;
    const seatmapId = searchParams.get("seatmapId") || undefined;

    const shows = await getShows({
      query,
      status,
      statusGroup,
      sort,
      seatmapId,
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
