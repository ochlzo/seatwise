import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInviteToken } from "@/lib/invite/adminInvite";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; username?: string };
    const token = body.token?.trim();
    const username = body.username?.trim() ?? "";

    if (!token) {
      return NextResponse.json({ error: "Invite token is required." }, { status: 400 });
    }

    verifyInviteToken(token);

    if (username.length < 2) {
      return NextResponse.json({ taken: false });
    }

    const existingAdmin = await prisma.admin.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      select: { user_id: true },
    });

    return NextResponse.json({ taken: Boolean(existingAdmin) });
  } catch (error) {
    console.error("[admin/access/invite/check-username][POST] Error:", error);
    return NextResponse.json({ error: "Unable to validate username." }, { status: 400 });
  }
}
