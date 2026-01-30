import { NextResponse } from "next/server";
import { getActiveSeatmaps } from "@/lib/db/Seatmaps";

export async function GET() {
  try {
    const seatmaps = await getActiveSeatmaps();
    return NextResponse.json({ seatmaps });
  } catch (error) {
    console.error("Error fetching seatmaps:", error);
    return NextResponse.json(
      { error: "Failed to load seatmaps" },
      { status: 500 }
    );
  }
}
