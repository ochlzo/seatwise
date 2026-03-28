"use client";

import * as React from "react";
import { Users, MailPlus, Loader2, Pencil, Search, UserRoundCheck } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type TeamAdmin = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  username: string | null;
  status: "ACTIVE" | "INACTIVE";
  is_superadmin: boolean;
  createdAt: string;
};

export type TeamLeader = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  username: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export type Team = {
  team_id: string;
  name: string;
  team_leader_admin_id: string | null;
  team_leader: TeamLeader | null;
  admins: TeamAdmin[];
};

type TeamAccessDetailProps = {
  team: Team;
  canManage: boolean;
  renameValue: string;
  inviteValue: string;
  inviteError: string;
  adminSearchQuery: string;
  renamingTeamId: string | null;
  invitingTeamId: string | null;
  assigningTeamLeaderId: string | null;
  isSetupMode?: boolean;
  setupInvitesSent?: number;
  isCompletingSetup?: boolean;
  onRenameChange: (value: string) => void;
  onInviteChange: (value: string) => void;
  onInviteErrorChange: (value: string) => void;
  onAdminSearchChange: (value: string) => void;
  onRename: () => void;
  onInvite: () => void;
  onTeamLeaderChange: (adminId: string) => void;
  onCompleteSetup?: () => void;
};

const fullName = (admin: Pick<TeamAdmin, "first_name" | "last_name" | "email">) =>
  `${admin.first_name ?? ""} ${admin.last_name ?? ""}`.trim() || admin.email;

const canBeTeamLeader = (admin: TeamAdmin) =>
  admin.status === "ACTIVE" && !admin.is_superadmin;

export function TeamAccessDetail({
  team,
  canManage,
  renameValue,
  inviteValue,
  inviteError,
  adminSearchQuery,
  renamingTeamId,
  invitingTeamId,
  assigningTeamLeaderId,
  isSetupMode = false,
  setupInvitesSent = 0,
  isCompletingSetup = false,
  onRenameChange,
  onInviteChange,
  onInviteErrorChange,
  onAdminSearchChange,
  onRename,
  onInvite,
  onTeamLeaderChange,
  onCompleteSetup,
}: TeamAccessDetailProps) {
  const [leaderSelectionEnabled, setLeaderSelectionEnabled] = React.useState(false);

  React.useEffect(() => {
    setLeaderSelectionEnabled(false);
  }, [team.team_id]);

  const query = adminSearchQuery.trim().toLowerCase();
  const filteredAdmins = React.useMemo(() => {
    if (!query) return team.admins;
    return team.admins.filter((admin) => {
      const displayName = fullName(admin).toLowerCase();
      const email = admin.email.toLowerCase();
      const username = (admin.username ?? "").toLowerCase();
      return (
        displayName.includes(query) ||
        email.includes(query) ||
        username.includes(query)
      );
    });
  }, [query, team.admins]);

  const leaderName =
    team.team_leader != null ? fullName(team.team_leader) : "Not assigned";

  const leaderRadioValue = team.team_leader_admin_id ?? "";
  const leaderRadioDisabled =
    assigningTeamLeaderId != null || !canManage || !leaderSelectionEnabled;

  return (
    <div className="space-y-3 md:space-y-4">
      <Card className="border-0 bg-transparent py-0 shadow-none md:border md:bg-card md:py-6 md:shadow-sm">
        <CardHeader className="px-0 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Users className="h-4 w-4 md:h-5 md:w-5" />
                {team.name}
              </CardTitle>
              <CardDescription>{team.admins.length} admin member(s)</CardDescription>
            </div>
          </div>
        </CardHeader>
        {canManage && (
          <CardContent className="space-y-3 px-0 md:space-y-4 md:px-6">
            {!isSetupMode && (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`rename-${team.team_id}`}>Team name</Label>
                  <div className="flex items-end gap-2">
                    <Input
                      id={`rename-${team.team_id}`}
                      value={renameValue}
                      onChange={(event) => onRenameChange(event.target.value)}
                      className="h-8 text-sm md:h-9 md:text-base"
                    />
                    <Button
                      variant="outline"
                      onClick={onRename}
                      disabled={renamingTeamId === team.team_id}
                      className="h-8 w-28 justify-center gap-2 px-2 text-xs md:h-9 md:w-36 md:text-sm"
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
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor={`invite-${team.team_id}`}>Invite admin by email</Label>
              <div className="flex items-end gap-2">
                <div className="w-full space-y-1">
                  <Input
                    id={`invite-${team.team_id}`}
                    type="email"
                    placeholder="admin@email.com"
                    value={inviteValue}
                    onChange={(event) => {
                      onInviteChange(event.target.value);
                      if (inviteError) onInviteErrorChange("");
                    }}
                    className={`h-8 text-sm md:h-9 md:text-base${inviteError ? " border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {inviteError && (
                    <p className="text-xs text-destructive">{inviteError}</p>
                  )}
                </div>
                <Button
                  onClick={onInvite}
                  disabled={invitingTeamId === team.team_id}
                  className="h-8 w-28 justify-center gap-2 px-2 text-xs md:h-9 md:w-36 md:text-sm"
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

            {isSetupMode && (
              <div className="rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-semibold">Team setup required</p>
                <p className="mt-1">
                  Invite at least one admin before finishing this setup flow. First accepted admin is assigned as team leader automatically.
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p>
                    Invites sent in this setup session: <span className="font-semibold">{setupInvitesSent}</span>
                  </p>
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs"
                    disabled={!onCompleteSetup || setupInvitesSent < 1 || isCompletingSetup}
                    onClick={onCompleteSetup}
                  >
                    {isCompletingSetup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Complete Setup
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Separator className="my-2 md:hidden" />

      <Card className="mt-4 gap-4 py-1 shadow-sm md:mt-2 md:py-4">
        <CardHeader className="gap-2 px-3 pb-0 pt-2 md:px-6 md:pb-0">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm">Team admins</CardTitle>
              <p className="text-xs text-muted-foreground">
                Team leader: <span className="font-medium text-foreground">{leaderName}</span>
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
              {canManage && (
                <div className="order-2 flex items-center gap-2 self-start md:order-1 md:self-auto">
                  <Label htmlFor={`team-leader-toggle-${team.team_id}`} className="text-xs text-muted-foreground">
                    Select team leader
                  </Label>
                  <Switch
                    id={`team-leader-toggle-${team.team_id}`}
                    checked={leaderSelectionEnabled}
                    onCheckedChange={setLeaderSelectionEnabled}
                  />
                </div>
              )}
              <div className="order-1 relative w-full max-w-xs md:order-2 md:w-[320px]">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={adminSearchQuery}
                  onChange={(event) => onAdminSearchChange(event.target.value)}
                  placeholder="Search admin..."
                  className="h-8 pl-8 text-xs md:text-sm"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-2 pt-0 md:px-6 md:pt-0">
          {filteredAdmins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {team.admins.length === 0
                ? "No admins in this team yet."
                : "No admins match your search."}
            </p>
          ) : (
            <>
              <RadioGroup
                value={leaderRadioValue}
                onValueChange={(value) => {
                  if (!leaderSelectionEnabled || !value) return;
                  void onTeamLeaderChange(value);
                }}
                className="space-y-1 md:hidden"
              >
                {filteredAdmins.map((admin) => {
                  const isCurrentLeader = admin.user_id === team.team_leader_admin_id;
                  const leaderOptionDisabled =
                    leaderRadioDisabled || !canBeTeamLeader(admin);

                  return (
                    <div
                      key={admin.user_id}
                      className="relative flex flex-col gap-1 rounded-lg border border-sidebar-border/60 p-2 pr-24 sm:flex-row sm:items-center sm:justify-between sm:pr-3"
                    >
                      <div className="flex items-start gap-2">
                        {leaderSelectionEnabled && (
                          <RadioGroupItem
                            value={admin.user_id}
                            disabled={leaderOptionDisabled}
                            className="mt-0.5"
                          />
                        )}
                        <div>
                          <p className="text-xs font-semibold">{fullName(admin)}</p>
                          <p className="text-[11px] text-muted-foreground">{admin.email}</p>
                          {admin.username && (
                            <p className="text-[11px] text-muted-foreground">@{admin.username}</p>
                          )}
                        </div>
                      </div>
                      <div className="absolute right-2 top-2 flex flex-col items-end gap-1 sm:static sm:flex-row sm:items-center sm:gap-2">
                        {isCurrentLeader && <Badge variant="secondary">Leader</Badge>}
                        <Badge variant={admin.status === "ACTIVE" ? "default" : "outline"}>
                          {admin.status}
                        </Badge>
                        {admin.is_superadmin && <Badge variant="outline">Superadmin</Badge>}
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>

              <div className="hidden overflow-x-auto md:block">
                <RadioGroup
                  value={leaderRadioValue}
                  onValueChange={(value) => {
                    if (!leaderSelectionEnabled || !value) return;
                    void onTeamLeaderChange(value);
                  }}
                  className="gap-0"
                >
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-sidebar-border/70 text-left text-muted-foreground">
                        {leaderSelectionEnabled && <th className="w-12 py-2 pr-4 font-medium">Leader</th>}
                        <th className="py-2 pr-4 font-medium">Name</th>
                        <th className="py-2 pr-4 font-medium">Username</th>
                        <th className="py-2 pr-4 font-medium">Email</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdmins.map((admin) => {
                        const isCurrentLeader = admin.user_id === team.team_leader_admin_id;
                        const leaderOptionDisabled =
                          leaderRadioDisabled || !canBeTeamLeader(admin);

                        return (
                          <tr
                            key={admin.user_id}
                            className="border-b border-sidebar-border/40 last:border-0"
                          >
                            {leaderSelectionEnabled && (
                              <td className="py-2 pr-4">
                                <RadioGroupItem
                                  value={admin.user_id}
                                  disabled={leaderOptionDisabled}
                                />
                              </td>
                            )}
                            <td className="py-2 pr-4 font-medium">{fullName(admin)}</td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {admin.username ? `@${admin.username}` : "--"}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">{admin.email}</td>
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-2">
                                {isCurrentLeader && (
                                  <Badge variant="secondary" className="gap-1">
                                    <UserRoundCheck className="h-3.5 w-3.5" />
                                    Leader
                                  </Badge>
                                )}
                                <Badge variant={admin.status === "ACTIVE" ? "default" : "outline"}>
                                  {admin.status}
                                </Badge>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </RadioGroup>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
