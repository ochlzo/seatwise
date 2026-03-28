import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

type Params = {
  params: Promise<{ userId: string }>;
};

type RolePayload = {
  isSuperadmin?: boolean;
  teamId?: string | null;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const adminContext = await getCurrentAdminContext();
    if (!adminContext.isSuperadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const body = (await request.json()) as RolePayload;

    if (typeof body.isSuperadmin !== "boolean") {
      return NextResponse.json(
        { error: "isSuperadmin boolean is required." },
        { status: 400 },
      );
    }

    if (!body.isSuperadmin) {
      const teamId = body.teamId?.trim();
      if (!teamId) {
        return NextResponse.json(
          { error: "teamId is required when demoting a superadmin." },
          { status: 400 },
        );
      }

      const team = await prisma.team.findUnique({
        where: { team_id: teamId },
        select: { team_id: true },
      });
      if (!team) {
        return NextResponse.json({ error: "Team not found." }, { status: 404 });
      }
    }

    const targetTeamId = body.isSuperadmin ? null : body.teamId!.trim();
    const updated = await prisma.$transaction(async (tx) => {
      const admin = await tx.admin.update({
        where: { user_id: userId },
        data: body.isSuperadmin
          ? {
              is_superadmin: true,
              team_id: null,
            }
          : {
              is_superadmin: false,
              team_id: targetTeamId,
            },
        select: {
          user_id: true,
          email: true,
          first_name: true,
          last_name: true,
          username: true,
          status: true,
          is_superadmin: true,
          team_id: true,
          updatedAt: true,
        },
      });

      if (body.isSuperadmin) {
        await tx.team.updateMany({
          where: {
            team_leader_admin_id: userId,
          },
          data: {
            team_leader_admin_id: null,
          },
        });
      } else if (targetTeamId) {
        await tx.team.updateMany({
          where: {
            team_leader_admin_id: userId,
            NOT: {
              team_id: targetTeamId,
            },
          },
          data: {
            team_leader_admin_id: null,
          },
        });

        await tx.team.updateMany({
          where: {
            team_id: targetTeamId,
            team_leader_admin_id: null,
          },
          data: {
            team_leader_admin_id: userId,
          },
        });
      }

      return admin;
    });

    return NextResponse.json({
      success: true,
      admin: updated,
    });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/access/admins/:userId/role][PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update admin role." }, { status: 500 });
  }
}

