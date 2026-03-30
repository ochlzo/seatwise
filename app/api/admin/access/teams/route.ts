import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

export async function GET(request: NextRequest) {
  try {
    const adminContext = await getCurrentAdminContext();

    if (!adminContext.isSuperadmin && !adminContext.teamId) {
      return NextResponse.json({ error: "Admin team is not assigned." }, { status: 403 });
    }

    const url = new URL(request.url);
    const lite = url.searchParams.get("lite") === "1";

    const teams = lite
      ? await prisma.team.findMany({
          where: adminContext.isSuperadmin ? undefined : { team_id: adminContext.teamId! },
          select: {
            team_id: true,
            name: true,
          },
          orderBy: { name: "asc" },
        })
      : await prisma.team.findMany({
          where: adminContext.isSuperadmin ? undefined : { team_id: adminContext.teamId! },
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
          orderBy: { name: "asc" },
        });

    return NextResponse.json({
      success: true,
      currentAdmin: {
        teamId: adminContext.teamId,
        teamName: adminContext.teamName,
        isSuperadmin: adminContext.isSuperadmin,
      },
      teams,
    });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/access/teams][GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminContext = await getCurrentAdminContext();
    if (!adminContext.isSuperadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    const created = await prisma.team.create({
      data: {
        team_id: crypto.randomUUID(),
        name,
      },
      select: { team_id: true, name: true, createdAt: true },
    });

    return NextResponse.json({ success: true, team: created });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[admin/access/teams][POST] Error:", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
