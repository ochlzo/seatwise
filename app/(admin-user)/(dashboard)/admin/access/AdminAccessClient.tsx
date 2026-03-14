"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { ShieldCheck, Loader2, Plus, Search, Trash2, AlertTriangle, Pencil, Check, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [inviteEmailError, setInviteEmailError] = React.useState<Record<string, string>>({});
  const [invitingTeamId, setInvitingTeamId] = React.useState<string | null>(null);
  const [teamSearchQuery, setTeamSearchQuery] = React.useState("");
  const [adminSearchQuery, setAdminSearchQuery] = React.useState("");
  const [superadminInviteEmail, setSuperadminInviteEmail] = React.useState("");
  const [superadminInviteEmailError, setSuperadminInviteEmailError] = React.useState("");
  const [showSuperadminConfirm, setShowSuperadminConfirm] = React.useState(false);
  const [superadminConfirmIsPromotion, setSuperadminConfirmIsPromotion] = React.useState(false);
  const [superadminConfirmTeamName, setSuperadminConfirmTeamName] = React.useState<string | null>(null);
  const [isInvitingSuperadmin, setIsInvitingSuperadmin] = React.useState(false);
  const [deleteTargetTeam, setDeleteTargetTeam] = React.useState<Team | null>(null);
  const [isDeletingTeam, setIsDeletingTeam] = React.useState(false);
  const [inlineEditTeamId, setInlineEditTeamId] = React.useState<string | null>(null);
  const [inlineEditDraft, setInlineEditDraft] = React.useState("");

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
      setInviteEmailError((prev) => ({ ...prev, [targetTeamId]: "Email is required." }));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteEmailError((prev) => ({ ...prev, [targetTeamId]: "Enter a valid email address." }));
      return;
    }

    try {
      const checkRes = await fetch(
        `/api/admin/access/invite?teamId=${encodeURIComponent(targetTeamId)}&email=${encodeURIComponent(email)}`,
      );
      const checkData = (await checkRes.json()) as {
        exists?: boolean;
        isTeamMember?: boolean;
        error?: string;
      };
      if (!checkRes.ok) {
        toast.error(checkData.error ?? "Failed to check admin status.");
        return;
      }
      if (checkData.exists && checkData.isTeamMember) {
        setInviteEmailError((prev) => ({
          ...prev,
          [targetTeamId]: "This email is already a member of this team.",
        }));
        return;
      }
    } catch {
      toast.error("Failed to check admin status.");
      return;
    }

    setInviteEmailError((prev) => ({ ...prev, [targetTeamId]: "" }));
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

  const deleteTeam = async () => {
    if (!deleteTargetTeam) return;

    setIsDeletingTeam(true);
    try {
      const res = await fetch(`/api/admin/access/teams/${deleteTargetTeam.team_id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete team.");
      }

      toast.success("Team deleted.");
      setDeleteTargetTeam(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete team.");
    } finally {
      setIsDeletingTeam(false);
    }
  };

  const requestSuperadminInvite = async () => {
    const email = superadminInviteEmail.trim();
    if (!email) {
      setSuperadminInviteEmailError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSuperadminInviteEmailError("Enter a valid email address.");
      return;
    }
    setSuperadminInviteEmailError("");

    try {
      const res = await fetch(
        `/api/admin/access/invite/superadmin?email=${encodeURIComponent(email)}`,
      );
      const data = (await res.json()) as {
        exists?: boolean;
        isSuperadmin?: boolean;
        isTeamAdmin?: boolean;
        teamName?: string | null;
        error?: string;
      };

      if (!res.ok) {
        toast.error(data.error ?? "Failed to check admin status.");
        return;
      }

      if (data.exists && data.isSuperadmin) {
        setSuperadminInviteEmailError("This email is already registered as a superadmin.");
        return;
      }

      setSuperadminConfirmIsPromotion(Boolean(data.exists && data.isTeamAdmin));
      setSuperadminConfirmTeamName(data.teamName ?? null);
      setShowSuperadminConfirm(true);
    } catch {
      toast.error("Failed to check admin status.");
    }
  };

  const sendSuperadminInvite = async () => {
    const email = superadminInviteEmail.trim();
    setShowSuperadminConfirm(false);
    setIsInvitingSuperadmin(true);
    try {
      const res = await fetch("/api/admin/access/invite/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        promotedExistingAdmin?: boolean;
      };
      if (!res.ok || !data.success) {
        const message = data.error || "Failed to process superadmin invite.";
        if (res.status === 400) {
          setSuperadminInviteEmailError(message);
        } else {
          toast.error(message);
        }
        return;
      }

      setSuperadminInviteEmail("");
      if (data.promotedExistingAdmin) {
        toast.success("Existing admin promoted to superadmin and detached from team.");
        await loadData();
      } else {
        toast.success("Superadmin invite email sent.");
      }
    } catch {
      toast.error("Failed to process superadmin invite.");
    } finally {
      setIsInvitingSuperadmin(false);
    }
  };

  const inlineRenameTeam = async (targetTeamId: string) => {
    const name = inlineEditDraft.trim();
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

      setInlineEditTeamId(null);
      toast.success("Team renamed.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update team.");
    } finally {
      setRenamingTeamId(null);
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
            <CardTitle className="text-base md:text-lg">Invite Superadmin</CardTitle>
            <CardDescription>
              Invite a platform-level superadmin. Existing team admins with this email are promoted and unassigned from teams.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 md:px-6">
            <div className="flex items-end gap-2">
              <div className="w-full space-y-2">
                <Label htmlFor="superadmin-invite-email">Superadmin email</Label>
                <Input
                  id="superadmin-invite-email"
                  type="email"
                  value={superadminInviteEmail}
                  onChange={(event) => {
                    setSuperadminInviteEmail(event.target.value);
                    if (superadminInviteEmailError) setSuperadminInviteEmailError("");
                  }}
                  placeholder="superadmin@email.com"
                  className={`h-8 text-sm md:h-9 md:text-base ${superadminInviteEmailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  onKeyDown={(e) => { if (e.key === "Enter") void requestSuperadminInvite(); }}
                />
                {superadminInviteEmailError && (
                  <p className="text-xs text-destructive">{superadminInviteEmailError}</p>
                )}
              </div>
              <Button
                onClick={() => void requestSuperadminInvite()}
                disabled={isInvitingSuperadmin}
                className="h-8 gap-2 px-3 text-xs md:h-9 md:text-sm"
              >
                {isInvitingSuperadmin ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Invite Superadmin
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isSuperadmin && !teamId && <Separator className="my-2 md:hidden" />}

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

      {isSuperadmin && !teamId && <Separator className="my-2 md:hidden" />}

      {isSuperadmin && !teamId ? (
        <Card className="border-0 bg-transparent py-0 shadow-none md:border md:bg-card md:py-3 md:shadow-sm">
          <CardHeader className="px-0 pb-0 pt-2 md:px-6 md:pb-3 md:pt-6">
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
                  {filteredTeams.map((team) => {
                    const isEditing = inlineEditTeamId === team.team_id;
                    const isSaving = renamingTeamId === team.team_id;
                    return (
                      <div
                        key={team.team_id}
                        className="rounded-lg border border-sidebar-border/60 p-3 transition"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              autoFocus
                              value={inlineEditDraft}
                              onChange={(e) => setInlineEditDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void inlineRenameTeam(team.team_id);
                                if (e.key === "Escape") setInlineEditTeamId(null);
                              }}
                              className="h-7 text-sm font-semibold"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={isSaving}
                              onClick={() => void inlineRenameTeam(team.team_id)}
                              className="h-7 px-2"
                            >
                              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isSaving}
                              onClick={() => setInlineEditTeamId(null)}
                              className="h-7 px-2"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => router.push(`/admin/access/${team.team_id}`)}
                              className="flex-1 text-left"
                            >
                              <p className="text-sm font-semibold">{team.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {team.admins.length} admin member(s)
                              </p>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setInlineEditDraft(team.name);
                                setInlineEditTeamId(team.team_id);
                              }}
                              className="h-7 gap-1 px-2 text-xs"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Rename
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-sidebar-border/70 text-left text-muted-foreground">
                        <th className="py-3 pr-4 font-medium">Team</th>
                        <th className="py-3 pr-4 font-medium">Admins</th>
                        <th className="py-3 pr-0 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeams.map((team) => {
                        const isEditing = inlineEditTeamId === team.team_id;
                        const isSaving = renamingTeamId === team.team_id;
                        return (
                          <tr
                            key={team.team_id}
                            className="border-b border-sidebar-border/40 last:border-0"
                          >
                            <td className="py-3 pr-4 font-medium">
                              {isEditing ? (
                                <Input
                                  autoFocus
                                  value={inlineEditDraft}
                                  onChange={(e) => setInlineEditDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void inlineRenameTeam(team.team_id);
                                    if (e.key === "Escape") setInlineEditTeamId(null);
                                  }}
                                  className="h-7 text-sm"
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:underline"
                                  onClick={() => router.push(`/admin/access/${team.team_id}`)}
                                >
                                  {team.name}
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">{team.admins.length}</td>
                            <td className="py-3 pr-0">
                              <div className="flex items-center gap-1">
                                {isEditing ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={isSaving}
                                      onClick={() => void inlineRenameTeam(team.team_id)}
                                      className="h-7 gap-1 px-2 text-xs"
                                    >
                                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={isSaving}
                                      onClick={() => setInlineEditTeamId(null)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInlineEditDraft(team.name);
                                        setInlineEditTeamId(team.team_id);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Rename
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 text-destructive hover:bg-destructive/10 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteTargetTeam(team);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
          onInviteErrorChange={(value) =>
            setInviteEmailError((prev) => ({
              ...prev,
              [selectedTeam.team_id]: value,
            }))
          }
          inviteError={inviteEmailError[selectedTeam.team_id] ?? ""}
          onAdminSearchChange={setAdminSearchQuery}
          onRename={() => renameTeam(selectedTeam.team_id)}
          onInvite={() => void sendInvite(selectedTeam.team_id)}
        />
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">No team data available.</p>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showSuperadminConfirm}
        onOpenChange={(open) => { if (!open) setShowSuperadminConfirm(false); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle>
              {superadminConfirmIsPromotion ? "Promote to superadmin?" : "Confirm superadmin invite?"}
            </DialogTitle>
            <DialogDescription>
              {superadminConfirmIsPromotion ? (
                <>
                  <span className="font-semibold text-foreground">{superadminInviteEmail.trim()}</span>
                  {" "}is currently a team admin{superadminConfirmTeamName ? <> of <span className="font-semibold text-foreground">{superadminConfirmTeamName}</span></> : ""}. Proceeding will promote them to superadmin and remove them from their team.
                </>
              ) : (
                <>
                  An invite will be sent to{" "}
                  <span className="font-semibold text-foreground">{superadminInviteEmail.trim()}</span>
                  . Please confirm the email is correct before proceeding.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuperadminConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => void sendSuperadminInvite()} className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              {superadminConfirmIsPromotion ? "Confirm & Promote" : "Confirm & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTargetTeam)}
        onOpenChange={(open) => {
          if (!open && !isDeletingTeam) {
            setDeleteTargetTeam(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle>Delete team?</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTargetTeam?.name}
              </span>
              . This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTargetTeam(null)}
              disabled={isDeletingTeam}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteTeam}
              disabled={isDeletingTeam}
              className="gap-2"
            >
              {isDeletingTeam ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

