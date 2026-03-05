import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

type Params = {
  params: Promise<{ teamId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const adminContext = await getCurrentAdminContext();
    const { teamId } = await params;

    if (!adminContext.isSuperadmin && adminContext.teamId !== teamId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    const updated = await prisma.team.update({
      where: { team_id: teamId },
      data: { name },
      select: { team_id: true, name: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, team: updated });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/access/teams/:teamId][PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update team." }, { status: 500 });
  }
}
