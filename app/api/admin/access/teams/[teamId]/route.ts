import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

type Params = {
  params: Promise<{ teamId: string }>;
};

type TeamPatchBody = {
  name?: string;
  teamLeaderAdminId?: string | null;
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
        team_leader: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            username: true,
            status: true,
          },
        },
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

    const body = (await request.json()) as TeamPatchBody;
    const hasName = typeof body.name === "string";
    const hasTeamLeaderUpdate = Object.prototype.hasOwnProperty.call(body, "teamLeaderAdminId");

    if (!hasName && !hasTeamLeaderUpdate) {
      return NextResponse.json(
        { error: "Nothing to update. Provide name and/or teamLeaderAdminId." },
        { status: 400 },
      );
    }

    const data: { name?: string; team_leader_admin_id?: string | null } = {};
    if (hasName) {
      const name = body.name?.trim();
      if (!name) {
        return NextResponse.json({ error: "Team name is required." }, { status: 400 });
      }
      data.name = name;
    }

    if (hasTeamLeaderUpdate) {
      if (body.teamLeaderAdminId == null) {
        data.team_leader_admin_id = null;
      } else {
        const candidateId = body.teamLeaderAdminId.trim();
        if (!candidateId) {
          return NextResponse.json({ error: "Team leader admin id is required." }, { status: 400 });
        }

        const leaderCandidate = await prisma.admin.findFirst({
          where: {
            user_id: candidateId,
            team_id: teamId,
            status: "ACTIVE",
            is_superadmin: false,
          },
          select: { user_id: true },
        });

        if (!leaderCandidate) {
          return NextResponse.json(
            { error: "Team leader must be an active team admin." },
            { status: 400 },
          );
        }

        data.team_leader_admin_id = leaderCandidate.user_id;
      }
    }

    const updated = await prisma.team.update({
      where: { team_id: teamId },
      data,
      include: {
        team_leader: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            username: true,
            status: true,
          },
        },
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
