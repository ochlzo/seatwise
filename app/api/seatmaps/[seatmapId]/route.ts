import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seatmapId: string }> }
) {
  // Force TS Re-eval
  try {
    const { adminAuth } = await import("@/lib/firebaseAdmin");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const user = await prisma.user.findUnique({
      where: { firebase_uid: decodedToken.uid },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { seatmapId } = await params;
    const seatmap = await prisma.seatmap.findUnique({
      where: { seatmap_id: seatmapId },
      include: {
        seatCategories: true,
      },
    });

    if (!seatmap) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      seatmap_id: seatmap.seatmap_id,
      seatmap_name: seatmap.seatmap_name,
      seatmap_json: seatmap.seatmap_json,
      seat_categories: seatmap.seatCategories,
    });
  } catch (error) {
    console.error("Error loading seatmap:", error);
    return NextResponse.json({ error: "Failed to load seatmap" }, { status: 500 });
  }
}
