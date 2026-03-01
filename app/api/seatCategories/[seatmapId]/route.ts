import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seatmapId: string }> }
) {
  try {
    const { adminAuth } = await import("@/lib/firebaseAdmin");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const admin = await prisma.admin.findUnique({
      where: { firebase_uid: decodedToken.uid },
      select: { user_id: true },
    });

    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { seatmapId } = await params;

    const seatCategories = await prisma.seatCategory.findMany({
      where: { seatmap_id: seatmapId },
      include: {
        seatmap: true,
        sets: {
          include: {
            sched: true,
          },
        },
      } as Prisma.SeatCategoryInclude,
      orderBy: { category_name: "asc" } as Prisma.SeatCategoryOrderByWithRelationInput,
    });

    return NextResponse.json({ seatCategories });
  } catch (error) {
    console.error("Error loading seat categories:", error);
    return NextResponse.json(
      { error: "Failed to load seat categories" },
      { status: 500 }
    );
  }
}

