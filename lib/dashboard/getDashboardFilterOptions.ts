import type { PrismaClient } from "@prisma/client";

import { prisma } from "../prisma.ts";

import type {
  AdminDashboardFilterOptions,
  DashboardAdminScope,
  DashboardFilterOption,
} from "./types.ts";

type GetDashboardFilterOptionsArgs = {
  adminScope: DashboardAdminScope;
  teamId: string | null;
  db?: PrismaClient;
};

const toOption = (value: string, label: string): DashboardFilterOption => ({
  value,
  label,
});

export async function getDashboardFilterOptions({
  adminScope,
  teamId,
  db = prisma,
}: GetDashboardFilterOptionsArgs): Promise<AdminDashboardFilterOptions> {
  const canFilterTeams = adminScope.isSuperadmin;

  const [teams, shows] = await Promise.all([
    canFilterTeams
      ? db.team.findMany({
          select: {
            team_id: true,
            name: true,
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    db.show.findMany({
      where: teamId ? { team_id: teamId } : undefined,
      select: {
        show_id: true,
        show_name: true,
      },
      orderBy: { show_name: "asc" },
    }),
  ]);

  return {
    canFilterTeams,
    teams: teams.map((team) => toOption(team.team_id, team.name)),
    shows: shows.map((show) => toOption(show.show_id, show.show_name)),
  };
}
