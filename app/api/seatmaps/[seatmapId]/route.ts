import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { ShowStatus } from "@prisma/client";

const PUBLIC_SHOW_STATUSES: ShowStatus[] = ["DRAFT", "CANCELLED"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seatmapId: string }> }
) {
  try {
    const { seatmapId } = await params;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    let isAuthorizedAdmin = false;

    if (sessionCookie) {
      try {
        const { adminAuth } = await import("@/lib/firebaseAdmin");
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
        const user = await prisma.admin.findUnique({
          where: { firebase_uid: decodedToken.uid },
          select: { user_id: true },
        });

        isAuthorizedAdmin = Boolean(user);
      } catch {
        isAuthorizedAdmin = false;
      }
    }

    const seatmap = await prisma.seatmap.findUnique({
      where: { seatmap_id: seatmapId },
      include: {
        seatCategories: true,
        shows: isAuthorizedAdmin
          ? false
          : {
              where: {
                show_status: {
                  notIn: PUBLIC_SHOW_STATUSES,
                },
              },
              select: { show_id: true },
              take: 1,
            },
      },
    });

    if (!seatmap) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!isAuthorizedAdmin && seatmap.shows.length === 0) {
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
