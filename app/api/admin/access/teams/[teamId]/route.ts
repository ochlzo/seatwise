import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

type Params = {
  params: Promise<{ teamId: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const adminContext = await getCurrentAdminContext();
    const { teamId } = await params;

    if (!adminContext.isSuperadmin && adminContext.teamId !== teamId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const team = await prisma.team.findUnique({
      where: { team_id: teamId },
      include: {
        admins: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            username: true,
            status: true,
            is_superadmin: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      currentAdmin: {
        teamId: adminContext.teamId,
        teamName: adminContext.teamName,
        isSuperadmin: adminContext.isSuperadmin,
      },
      team,
    });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/access/teams/:teamId][GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch team." }, { status: 500 });
  }
}

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

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const adminContext = await getCurrentAdminContext();
    const { teamId } = await params;

    if (!adminContext.isSuperadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const team = await prisma.team.findUnique({
      where: { team_id: teamId },
      select: {
        team_id: true,
        _count: {
          select: {
            shows: true,
            admins: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    if (team._count.shows > 0) {
      return NextResponse.json(
        { error: "Cannot delete team with existing shows." },
        { status: 400 },
      );
    }

    if (team._count.admins > 0) {
      return NextResponse.json(
        { error: "Cannot delete team while admins are still assigned." },
        { status: 400 },
      );
    }

    await prisma.team.delete({
      where: { team_id: teamId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/access/teams/:teamId][DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete team." }, { status: 500 });
  }
}
