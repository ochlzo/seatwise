"use client";

import * as React from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { toast } from "@/components/ui/sonner";
import { useAppSelector } from "@/lib/hooks";
import type { RootState } from "@/lib/store";

type TeamOption = {
  id: string;
  label: string;
};

type TicketTemplateTeamSelectorProps = {
  selectedTeamId: string | null;
  onSelectedTeamIdChange: (teamId: string | null) => void;
  className?: string;
};

type TeamsResponse = {
  teams?: Array<{
    team_id: string;
    name: string;
  }>;
  currentAdmin?: {
    teamId: string | null;
    teamName: string | null;
    isSuperadmin: boolean;
  };
  error?: string;
};

export function TicketTemplateTeamSelector({
  selectedTeamId,
  onSelectedTeamIdChange,
  className,
}: TicketTemplateTeamSelectorProps) {
  const user = useAppSelector((state: RootState) => state.auth.user);
  const isSuperadmin = Boolean(user?.role === "ADMIN" && user?.isSuperadmin);
  const [teams, setTeams] = React.useState<TeamOption[]>([]);
  const [teamQuery, setTeamQuery] = React.useState("");
  const [isComboboxOpen, setIsComboboxOpen] = React.useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = React.useState(false);
  const selectedTeamIdRef = React.useRef<string | null>(selectedTeamId);

  React.useEffect(() => {
    selectedTeamIdRef.current = selectedTeamId;
  }, [selectedTeamId]);

  React.useEffect(() => {
    if (user?.role !== "ADMIN") {
      return;
    }

    let isMounted = true;

    const loadTeams = async () => {
      setIsLoadingTeams(true);
      try {
        const response = await fetch("/api/admin/access/teams");
        const data = (await response.json()) as TeamsResponse;

        if (!response.ok) {
          throw new Error(data.error || "Failed to load teams.");
        }

        if (!isMounted) {
          return;
        }

        const mappedTeams = (data.teams ?? []).map((team) => ({
          id: team.team_id,
          label: team.name,
        }));
        setTeams(mappedTeams);

        const currentAdminTeamId = data.currentAdmin?.teamId ?? null;
        const preferredTeamId =
          selectedTeamIdRef.current ??
          currentAdminTeamId ??
          (mappedTeams.length > 0 ? mappedTeams[0]?.id : null) ??
          null;

        if (
          preferredTeamId &&
          mappedTeams.some((team) => team.id === preferredTeamId)
        ) {
          onSelectedTeamIdChange(preferredTeamId);
          const selectedTeamLabel = mappedTeams.find(
            (team) => team.id === preferredTeamId,
          )?.label;
          setTeamQuery(selectedTeamLabel ?? "");
          return;
        }

        if (mappedTeams.length === 0) {
          onSelectedTeamIdChange(null);
          setTeamQuery("");
          return;
        }

        const fallbackTeamId = mappedTeams[0]?.id ?? null;
        onSelectedTeamIdChange(fallbackTeamId);
        setTeamQuery(mappedTeams[0]?.label ?? "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setTeams([]);
        onSelectedTeamIdChange(null);
        setTeamQuery("");
        toast.error(error instanceof Error ? error.message : "Failed to load teams.");
      } finally {
        if (isMounted) {
          setIsLoadingTeams(false);
        }
      }
    };

    void loadTeams();

    return () => {
      isMounted = false;
    };
  }, [onSelectedTeamIdChange, user?.role]);

  const selectedTeam =
    teams.find((team) => team.id === selectedTeamId) ?? null;

  React.useEffect(() => {
    if (!selectedTeam) {
      return;
    }

    setTeamQuery(selectedTeam.label);
  }, [selectedTeam]);

  const filteredTeams = React.useMemo(() => {
    const query = teamQuery.trim().toLowerCase();
    if (!query) {
      return teams;
    }

    return teams.filter((team) => team.label.toLowerCase().includes(query));
  }, [teamQuery, teams]);

  const isInteractive = isSuperadmin && teams.length > 0 && !isLoadingTeams;
  const displayValue =
    selectedTeam?.label ??
    user?.teamName ??
    (isLoadingTeams ? "Loading teams..." : "No team assigned");

  return (
    <Combobox
      open={isInteractive ? isComboboxOpen : false}
      onOpenChange={(open) => {
        if (!isInteractive) {
          return;
        }
        setIsComboboxOpen(open);
      }}
      openOnInputClick
      autoHighlight
      value={selectedTeamId ?? ""}
      onValueChange={(value) => {
        if (!isInteractive) {
          return;
        }

        const nextTeamId = value && value.length > 0 ? value : null;
        onSelectedTeamIdChange(nextTeamId);
        const nextTeam = teams.find((team) => team.id === nextTeamId);
        setTeamQuery(nextTeam?.label ?? "");
        setIsComboboxOpen(false);
      }}
    >
      <ComboboxInput
        aria-label="Select team"
        placeholder="Select team"
        disabled={!isInteractive}
        value={isInteractive ? teamQuery : displayValue}
        onFocus={() => {
          if (isInteractive) {
            setIsComboboxOpen(true);
          }
        }}
        onChange={(event) => {
          if (!isInteractive) {
            return;
          }
          setTeamQuery(event.target.value);
          setIsComboboxOpen(true);
        }}
        className={className}
      />
      <ComboboxContent>
        <ComboboxList className="max-h-72">
          {isLoadingTeams ? (
            <ComboboxItem value="__loading__" disabled>
              Loading teams...
            </ComboboxItem>
          ) : filteredTeams.length > 0 ? (
            filteredTeams.map((team) => (
              <ComboboxItem key={team.id} value={team.id}>
                {team.label}
              </ComboboxItem>
            ))
          ) : (
            <ComboboxEmpty>No teams found.</ComboboxEmpty>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
