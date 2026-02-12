import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";
import { getActiveSeatmaps } from "@/lib/db/Seatmaps";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const user = await prisma.user.findUnique({
      where: { firebase_uid: decodedToken.uid },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
