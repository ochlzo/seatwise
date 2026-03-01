import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get("username")?.trim();
    if (!username) {
      return NextResponse.json({ success: false, error: "Missing username." }, { status: 400 });
    }

    const admin = await prisma.admin.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      select: { email: true },
    });

    if (!admin) {
      return NextResponse.json({ success: false, error: "Admin account not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, email: admin.email });
  } catch (error) {
    console.error("[auth/admin-email] Error:", error);
    return NextResponse.json(
      { success: false, error: "Admin lookup failed. Check Prisma migration/client." },
      { status: 500 },
    );
  }
}
