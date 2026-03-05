"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Plus, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TeamAccessDetail, type Team } from "./components/TeamAccessDetail";

type AccessResponse = {
  success: boolean;
  currentAdmin: {
    teamId: string | null;
    teamName: string | null;
    isSuperadmin: boolean;
  };
  teams: Team[];
};

type TeamDetailResponse = {
  success: boolean;
  currentAdmin: {
    teamId: string | null;
    teamName: string | null;
    isSuperadmin: boolean;
  };
  team: Team;
};

type AdminAccessClientProps = {
  teamId?: string;
};

export function AdminAccessClient({ teamId }: AdminAccessClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [isSuperadmin, setIsSuperadmin] = React.useState(false);
  const [currentTeamId, setCurrentTeamId] = React.useState<string | null>(null);
  const [createName, setCreateName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [renameDraft, setRenameDraft] = React.useState<Record<string, string>>({});
  const [renamingTeamId, setRenamingTeamId] = React.useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState<Record<string, string>>({});
  const [invitingTeamId, setInvitingTeamId] = React.useState<string | null>(null);
  const [teamSearchQuery, setTeamSearchQuery] = React.useState("");
  const [adminSearchQuery, setAdminSearchQuery] = React.useState("");

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = teamId
        ? `/api/admin/access/teams/${teamId}`
        : "/api/admin/access/teams";
      const res = await fetch(endpoint);
      const data = (await res.json()) as
        | AccessResponse
        | TeamDetailResponse
        | { error?: string };

      if (!res.ok || !("success" in data) || !data.success) {
        throw new Error(
          ("error" in data && data.error) || "Failed to load admin access data.",
        );
      }

      if ("team" in data) {
        setTeams([data.team]);
        setRenameDraft({ [data.team.team_id]: data.team.name });
      } else {
        setTeams(data.teams);
        setRenameDraft(
          Object.fromEntries(data.teams.map((team) => [team.team_id, team.name])),
        );
      }

      setIsSuperadmin(data.currentAdmin.isSuperadmin);
      setCurrentTeamId(data.currentAdmin.teamId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load admin access data.";
      toast.error(message);
      if (teamId) {
        router.replace("/admin/access");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router, teamId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const createTeam = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error("Team name is required.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/access/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create team.");
      }

      setCreateName("");
      toast.success("Team created.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create team.");
    } finally {
      setIsCreating(false);
    }
  };

  const renameTeam = async (targetTeamId: string) => {
    const name = (renameDraft[targetTeamId] ?? "").trim();
    if (!name) {
      toast.error("Team name is required.");
      return;
    }

    setRenamingTeamId(targetTeamId);
    try {
      const res = await fetch(`/api/admin/access/teams/${targetTeamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update team.");
      }

      toast.success("Team updated.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update team.");
    } finally {
      setRenamingTeamId(null);
    }
  };

  const sendInvite = async (targetTeamId: string) => {
    const email = (inviteEmail[targetTeamId] ?? "").trim();
    if (!email) {
      toast.error("Invite email is required.");
      return;
    }

    setInvitingTeamId(targetTeamId);
    try {
      const res = await fetch("/api/admin/access/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: targetTeamId, email }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send invite.");
      }

      setInviteEmail((prev) => ({ ...prev, [targetTeamId]: "" }));
      toast.success("Invite email sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invite.");
    } finally {
      setInvitingTeamId(null);
    }
  };

  const selectedTeam = React.useMemo(() => {
    if (teamId) {
      return teams.find((team) => team.team_id === teamId) ?? null;
    }
    if (!isSuperadmin) {
      return teams.find((team) => team.team_id === currentTeamId) ?? teams[0] ?? null;
    }
    return null;
  }, [currentTeamId, isSuperadmin, teamId, teams]);

  const filteredTeams = React.useMemo(() => {
    const query = teamSearchQuery.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter((team) => team.name.toLowerCase().includes(query));
  }, [teamSearchQuery, teams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-0 space-y-3 md:mx-2 md:space-y-6">
      <div className="mt-2 flex items-center gap-2 px-0 md:mt-5 md:gap-4 md:px-1">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-5 w-5" />
            Team Access Control
          </p>
          <p className="text-sm text-muted-foreground">
            {isSuperadmin
              ? "You can manage all teams, view admins, and send team invites."
              : "You can manage your own team, view admins, and send team invites."}
          </p>
        </div>
      </div>
      <Separator className="md:hidden" />

      {isSuperadmin && !teamId && (
        <Card className="border-0 bg-transparent py-0 shadow-none md:border md:bg-card md:py-6 md:shadow-sm">
          <CardHeader className="px-0 md:px-6">
            <CardTitle className="text-base md:text-lg">Create Team</CardTitle>
            <CardDescription>Add a new admin team.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 md:px-6">
            <div className="flex items-end gap-2">
              <div className="w-full space-y-2">
                <Label htmlFor="new-team-name">Team name</Label>
                <Input
                  id="new-team-name"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="e.g. Marketing Team"
                  className="h-8 text-sm md:h-9 md:text-base"
                />
              </div>
              <Button
                onClick={createTeam}
                disabled={isCreating}
                className="h-8 gap-2 px-3 text-xs md:h-9 md:text-sm"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create Team
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isSuperadmin && !teamId ? (
        <Card className="border-0 bg-transparent py-0 shadow-none md:border md:bg-card md:py-3 md:shadow-sm">
          <CardHeader className="px-0 pb-3 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base md:text-lg">Teams</CardTitle>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={teamSearchQuery}
                  onChange={(event) => setTeamSearchQuery(event.target.value)}
                  placeholder="Search team..."
                  className="h-8 pl-8 text-xs md:text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 md:px-6">
            {filteredTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams match your search.</p>
            ) : (
              <>
                <div className="space-y-2 md:hidden">
                  {filteredTeams.map((team) => (
                    <button
                      key={team.team_id}
                      type="button"
                      onClick={() => router.push(`/admin/access/${team.team_id}`)}
                      className="w-full rounded-lg border border-sidebar-border/60 p-3 text-left transition hover:bg-muted/40"
                    >
                      <p className="text-sm font-semibold">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.admins.length} admin member(s)
                      </p>
                    </button>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-sidebar-border/70 text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Team</th>
                        <th className="py-2 pr-4 font-medium">Admins</th>
                        <th className="py-2 pr-0 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeams.map((team) => (
                        <tr
                          key={team.team_id}
                          className="cursor-pointer border-b border-sidebar-border/40 last:border-0 hover:bg-muted/30"
                          onClick={() => router.push(`/admin/access/${team.team_id}`)}
                        >
                          <td className="py-2 pr-4 font-medium">{team.name}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{team.admins.length}</td>
                          <td className="py-2 pr-0 text-xs text-primary">View team</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : selectedTeam ? (
        <TeamAccessDetail
          team={selectedTeam}
          canManage={isSuperadmin || selectedTeam.team_id === currentTeamId}
          renameValue={renameDraft[selectedTeam.team_id] ?? selectedTeam.name}
          inviteValue={inviteEmail[selectedTeam.team_id] ?? ""}
          adminSearchQuery={adminSearchQuery}
          renamingTeamId={renamingTeamId}
          invitingTeamId={invitingTeamId}
          onRenameChange={(value) =>
            setRenameDraft((prev) => ({
              ...prev,
              [selectedTeam.team_id]: value,
            }))
          }
          onInviteChange={(value) =>
            setInviteEmail((prev) => ({
              ...prev,
              [selectedTeam.team_id]: value,
            }))
          }
          onAdminSearchChange={setAdminSearchQuery}
          onRename={() => renameTeam(selectedTeam.team_id)}
          onInvite={() => sendInvite(selectedTeam.team_id)}
        />
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">No team data available.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
