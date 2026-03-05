"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  MailPlus,
  Loader2,
  Plus,
  Pencil,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type TeamAdmin = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  username: string | null;
  status: "ACTIVE" | "INACTIVE";
  is_superadmin: boolean;
  createdAt: string;
};

type Team = {
  team_id: string;
  name: string;
  admins: TeamAdmin[];
};

type AccessResponse = {
  success: boolean;
  currentAdmin: {
    teamId: string | null;
    teamName: string | null;
    isSuperadmin: boolean;
  };
  teams: Team[];
};

const fullName = (admin: TeamAdmin) =>
  `${admin.first_name ?? ""} ${admin.last_name ?? ""}`.trim() || admin.email;

export function AdminAccessClient() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [isSuperadmin, setIsSuperadmin] = React.useState(false);
  const [currentTeamId, setCurrentTeamId] = React.useState<string | null>(null);
  const [createName, setCreateName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [renameDraft, setRenameDraft] = React.useState<Record<string, string>>(
    {},
  );
  const [renamingTeamId, setRenamingTeamId] = React.useState<string | null>(
    null,
  );
  const [inviteEmail, setInviteEmail] = React.useState<Record<string, string>>(
    {},
  );
  const [invitingTeamId, setInvitingTeamId] = React.useState<string | null>(
    null,
  );

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/access/teams");
      const data = (await res.json()) as AccessResponse | { error?: string };
      if (!res.ok || !("success" in data) || !data.success) {
        throw new Error(
          ("error" in data && data.error) ||
            "Failed to load admin access data.",
        );
      }

      setTeams(data.teams);
      setIsSuperadmin(data.currentAdmin.isSuperadmin);
      setCurrentTeamId(data.currentAdmin.teamId);
      setRenameDraft(
        Object.fromEntries(data.teams.map((team) => [team.team_id, team.name])),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load admin access data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      toast.error(
        error instanceof Error ? error.message : "Failed to create team.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const renameTeam = async (teamId: string) => {
    const name = (renameDraft[teamId] ?? "").trim();
    if (!name) {
      toast.error("Team name is required.");
      return;
    }

    setRenamingTeamId(teamId);
    try {
      const res = await fetch(`/api/admin/access/teams/${teamId}`, {
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
      toast.error(
        error instanceof Error ? error.message : "Failed to update team.",
      );
    } finally {
      setRenamingTeamId(null);
    }
  };

  const sendInvite = async (teamId: string) => {
    const email = (inviteEmail[teamId] ?? "").trim();
    if (!email) {
      toast.error("Invite email is required.");
      return;
    }

    setInvitingTeamId(teamId);
    try {
      const res = await fetch("/api/admin/access/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, email }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send invite.");
      }

      setInviteEmail((prev) => ({ ...prev, [teamId]: "" }));
      toast.success("Invite email sent.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send invite.",
      );
    } finally {
      setInvitingTeamId(null);
    }
  };

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

      {isSuperadmin && (
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

      <div className="grid gap-2 md:gap-4">
        {teams.map((team) => {
          const canManageThisTeam =
            isSuperadmin || team.team_id === currentTeamId;
          const currentRenameValue = renameDraft[team.team_id] ?? team.name;
          const currentInviteValue = inviteEmail[team.team_id] ?? "";

          return (
            <div key={team.team_id} className="space-y-2 md:space-y-3">
              <Card className="border-0 bg-transparent py-0 shadow-none md:border md:bg-card md:py-6 md:shadow-sm">
                <CardHeader className="px-0 md:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                        <Users className="h-4 w-4 md:h-5 md:w-5" />
                        {team.name}
                      </CardTitle>
                      <CardDescription>
                        {team.admins.length} admin member(s)
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                {canManageThisTeam && (
                  <CardContent className="space-y-3 px-0 md:space-y-4 md:px-6">
                    <div className="space-y-2">
                      <Label htmlFor={`rename-${team.team_id}`}>
                        Team name
                      </Label>
                      <div className="flex items-end gap-2">
                        <Input
                          id={`rename-${team.team_id}`}
                          value={currentRenameValue}
                          onChange={(event) =>
                            setRenameDraft((prev) => ({
                              ...prev,
                              [team.team_id]: event.target.value,
                            }))
                          }
                          className="h-8 text-sm md:h-9 md:text-base"
                        />
                        <Button
                          variant="outline"
                          onClick={() => renameTeam(team.team_id)}
                          disabled={renamingTeamId === team.team_id}
                          className="h-8 w-28 gap-2 justify-center px-2 text-xs md:h-9 md:w-36 md:text-sm"
                        >
                          {renamingTeamId === team.team_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                          Rename Team
                        </Button>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor={`invite-${team.team_id}`}>
                        Invite admin by email
                      </Label>
                      <div className="flex items-end gap-2">
                        <Input
                          id={`invite-${team.team_id}`}
                          type="email"
                          placeholder="admin@email.com"
                          value={currentInviteValue}
                          onChange={(event) =>
                            setInviteEmail((prev) => ({
                              ...prev,
                              [team.team_id]: event.target.value,
                            }))
                          }
                          className="h-8 text-sm md:h-9 md:text-base"
                        />
                        <Button
                          onClick={() => sendInvite(team.team_id)}
                          disabled={invitingTeamId === team.team_id}
                          className="h-8 w-28 gap-2 justify-center px-2 text-xs md:h-9 md:w-36 md:text-sm"
                        >
                          {invitingTeamId === team.team_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MailPlus className="h-4 w-4" />
                          )}
                          Send Invite
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              <Card className="mt-4 gap-4 py-1 shadow-sm md:mt-2 md:py-4">
                <CardHeader className="gap-0 px-3 pb-0 pt-2 md:px-6 md:pb-0">
                  <CardTitle className="text-sm">Team admins</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2 pt-0 md:px-6 md:pt-0">
                  {team.admins.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No admins in this team yet.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1 md:hidden">
                        {team.admins.map((admin) => (
                          <div
                            key={admin.user_id}
                            className="relative flex flex-col gap-1 rounded-lg border border-sidebar-border/60 p-2 pr-24 sm:flex-row sm:items-center sm:justify-between sm:pr-3"
                          >
                            <div>
                              <p className="text-xs font-semibold">{fullName(admin)}</p>
                              <p className="text-[11px] text-muted-foreground">{admin.email}</p>
                              {admin.username && (
                                <p className="text-[11px] text-muted-foreground">
                                  @{admin.username}
                                </p>
                              )}
                            </div>
                            <div className="absolute right-2 top-2 flex flex-col items-end gap-1 sm:static sm:flex-row sm:items-center sm:gap-2">
                              <Badge
                                variant={admin.status === "ACTIVE" ? "default" : "outline"}
                              >
                                {admin.status}
                              </Badge>
                              {admin.is_superadmin && (
                                <Badge variant="outline">Superadmin</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-sidebar-border/70 text-left text-muted-foreground">
                              <th className="py-2 pr-4 font-medium">Name</th>
                              <th className="py-2 pr-4 font-medium">Username</th>
                              <th className="py-2 pr-4 font-medium">Email</th>
                              <th className="py-2 pr-0 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {team.admins.map((admin) => (
                              <tr
                                key={admin.user_id}
                                className="border-b border-sidebar-border/40 last:border-0"
                              >
                                <td className="py-2 pr-4 font-medium">{fullName(admin)}</td>
                                <td className="py-2 pr-4 text-muted-foreground">
                                  {admin.username ? `@${admin.username}` : "—"}
                                </td>
                                <td className="py-2 pr-4 text-muted-foreground">
                                  {admin.email}
                                </td>
                                <td className="py-2 pr-0">
                                  <Badge
                                    variant={admin.status === "ACTIVE" ? "default" : "outline"}
                                  >
                                    {admin.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
