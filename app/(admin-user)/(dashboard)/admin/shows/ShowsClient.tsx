"use client";

import * as React from "react";
import { toast } from "@/components/ui/sonner";
import { PageHeader } from "@/components/page-header";
import { ShowFilters } from "./ShowFilters";
import AdminShield from "@/components/AdminShield";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Loader2, MapPin, Ticket, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { RootState } from "@/lib/store";

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "#3B82F6",
  DRAFT: "#64748B",
  OPEN: "#22C55E",
  CLOSED: "#6B7280",
  ON_GOING: "#F59E0B",
  CANCELLED: "#EF4444",
};

const formatTime = (date: Date) => {
  return date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(":00", "")
    .replace(" ", "");
};

type Show = {
  show_id: string;
  show_name: string;
  show_description: string;
  venue: string;
  address: string;
  show_status: string;
  show_start_date: Date;
  show_end_date: Date;
  show_image_key?: string | null;
  seatmap_id?: string | null;
  scheds: Array<{
    sched_start_time: Date;
    sched_end_time: Date;
  }>;
};

type TeamOption = {
  team_id: string;
  name: string;
};

type ShowsClientProps = {
  mode?: "admin" | "user";
  basePath?: string;
  detailBasePath?: string;
  enableLinks?: boolean;
  showHeader?: boolean;
  showFilters?: boolean;
  statusGroup?: "active";
  headerTitle?: string;
  headerSubtitle?: string;
  visibility?: "user" | "admin";
  statusFilterValues?: string[];
};

export default function ShowsPage({
  mode = "admin",
  basePath = "/admin/shows",
  detailBasePath,
  enableLinks = true,
  showHeader = true,
  showFilters = true,
  statusGroup,
  headerTitle,
  headerSubtitle,
  visibility = "admin",
  statusFilterValues,
}: ShowsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.auth.user);
  const teamDialogPortalContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [shows, setShows] = React.useState<Show[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isAssignTeamDialogOpen, setIsAssignTeamDialogOpen] = React.useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = React.useState(false);
  const [isTeamComboboxOpen, setIsTeamComboboxOpen] = React.useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = React.useState("");
  const [selectedTeamId, setSelectedTeamId] = React.useState("");
  const [selectedTeamName, setSelectedTeamName] = React.useState("");
  const [teams, setTeams] = React.useState<TeamOption[]>([]);
  const [hasLoadedTeams, setHasLoadedTeams] = React.useState(false);

  React.useEffect(() => {
    const fetchShows = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();

        if (searchQuery.trim()) {
          params.set("q", searchQuery.trim());
        }

        const status = searchParams.get("status");
        const sort = searchParams.get("sort");
        const seatmapId = searchParams.get("seatmapId");

        if (status) params.set("status", status);
        if (sort) params.set("sort", sort);
        if (seatmapId) params.set("seatmapId", seatmapId);
        if (statusGroup) params.set("statusGroup", statusGroup);
        if (visibility === "user") params.set("visibility", "user");

        const response = await fetch(`/api/shows/search?${params.toString()}`);

        if (response.status === 401) {
          if (mode === "admin") {
            // Admin view requires session; guest-facing views should not be forced to login.
            window.location.href = "/login";
          }
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch shows");
        }

        const data = await response.json();
        setShows(data.shows || []);
      } catch (error) {
        console.error("Failed to fetch shows:", error);
        setShows([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchShows();
    }, 500);

    return () => clearTimeout(timer);
  }, [mode, searchQuery, searchParams, statusGroup, visibility]);

  const hasFilters =
    searchParams.get("status") ||
    searchParams.get("sort") ||
    searchParams.get("seatmapId") ||
    searchQuery.trim();

  const isAdmin = mode === "admin";
  const isSuperadmin = Boolean(isAdmin && user?.isSuperadmin);
  const createPath = `${basePath}/create`;
  const detailPathBase = detailBasePath ?? basePath;

  const handleShowClick = React.useCallback(() => {
    dispatch(setLoading(true));
  }, [dispatch]);

  const loadTeams = React.useCallback(async () => {
    setIsLoadingTeams(true);
    try {
      const response = await fetch("/api/admin/access/teams?lite=1");
      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        teams?: TeamOption[];
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load teams.");
      }

      setTeams((data.teams ?? []).map((team) => ({
        team_id: team.team_id,
        name: team.name,
      })));
      setHasLoadedTeams(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load teams.");
    } finally {
      setIsLoadingTeams(false);
    }
  }, []);

  const handleCreateShowClick = React.useCallback(async () => {
    if (!isSuperadmin) {
      router.push(createPath);
      return;
    }

    if (teams.length === 0) {
      await loadTeams();
    }
    setSelectedTeamId("");
    setSelectedTeamName("");
    setTeamSearchQuery("");
    setIsTeamComboboxOpen(false);
    setIsAssignTeamDialogOpen(true);
  }, [createPath, isSuperadmin, loadTeams, router, teams.length]);

  React.useEffect(() => {
    if (!isSuperadmin || !isAssignTeamDialogOpen || hasLoadedTeams || isLoadingTeams) {
      return;
    }

    void loadTeams();
  }, [hasLoadedTeams, isAssignTeamDialogOpen, isLoadingTeams, isSuperadmin, loadTeams]);

  const handleConfirmTeamAssignment = React.useCallback(() => {
    if (!selectedTeamId) return;
    router.push(`${createPath}?teamId=${selectedTeamId}`);
    setIsAssignTeamDialogOpen(false);
  }, [createPath, router, selectedTeamId]);

  const filteredTeams = React.useMemo(() => {
    const query = teamSearchQuery.trim().toLowerCase();
    if (!query) return teams.slice(0, 10);
    return teams.filter((team) => team.name.toLowerCase().includes(query));
  }, [teamSearchQuery, teams]);

  return (
    <>
      {showHeader && (
        <PageHeader
          title="Shows"
          rightSlot={
            isAdmin ? (
              <>
                <ThemeSwithcer />
                <AdminShield />
              </>
            ) : undefined
          }
        />
      )}
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 pt-0">
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg md:text-xl font-semibold">
              {headerTitle ?? "Show Management"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {headerSubtitle ??
                "View and manage all events, venue details, and performance schedules."}
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search shows by name..."
                className="border-input h-9 w-full rounded-md border bg-transparent pl-9 pr-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              />
            </div>
            {isAdmin && (
              <Button
                className="w-full md:w-auto font-semibold shadow-md shadow-primary/10"
                onClick={handleCreateShowClick}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Show
              </Button>
            )}
            {showFilters && (
              <div className="w-full md:w-auto">
                <ShowFilters
                  hideStatusFilter={false}
                  allowedStatusValues={statusFilterValues}
                />
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card
                key={`show-skeleton-${index}`}
                className="overflow-hidden border-sidebar-border h-full"
              >
                <Skeleton className="aspect-[16/9] w-full" />
                <CardHeader className="pb-2 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="pt-4 border-t border-sidebar-border">
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : shows.length === 0 ? (
          <Card className="border-dashed flex flex-col items-center justify-center p-12 text-center bg-muted/10">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Ticket className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg md:text-xl mb-2 font-semibold">
              {hasFilters ? "NO MATCHING PRODUCTIONS" : "AWAITING PRODUCTIONS"}
            </CardTitle>
            <CardDescription className="max-w-xs mx-auto mb-6">
              {hasFilters
                ? "No shows match your current filter criteria. Try adjusting your filters or clearing them to see all shows."
                : "Your stage is currently empty. Create your first show to start managing seats and ticket sales."}
            </CardDescription>
            {hasFilters && (
              <Button variant="outline" asChild size="sm">
                <Link href={basePath}>Clear Filters</Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {shows.map((show: Show) =>
              enableLinks ? (
                <Link
                  key={show.show_id}
                  href={`${detailPathBase}/${show.show_id}`}
                  onClick={handleShowClick}
                >
                  <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-sidebar-border cursor-pointer h-full">
                    <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                      {show.show_image_key ? (
                        <Image
                          src={show.show_image_key}
                          alt={show.show_name}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                          width={400}
                          height={225}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                          <Ticket className="w-12 h-12 text-primary/20" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-lg md:text-xl font-semibold line-clamp-1 truncate">
                          {show.show_name}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[show.show_status as string] ||
                              "#6B7280",
                            color: "white",
                            borderColor: "transparent",
                          }}
                          className="shadow-sm font-semibold px-3 py-1 text-xs shrink-0"
                        >
                          {show.show_status.replace("_", " ")}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-1.5 font-medium text-primary/80">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="line-clamp-1">{show.venue}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">
                            {new Date(show.show_start_date).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            )}
                            {new Date(show.show_start_date).getTime() !==
                            new Date(show.show_end_date).getTime()
                              ? ` - ${new Date(show.show_end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                              : `, ${new Date(show.show_start_date).getFullYear()}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-sidebar-border">
                        <div className="flex flex-col max-w-full">
                          <span className="text-xs text-muted-foreground font-semibold">
                            Schedules
                          </span>
                          <span className="text-sm font-semibold line-clamp-1 text-primary/90">
                            {(() => {
                              const uniqueTimes = Array.from(
                                new Set(
                                  show.scheds.map(
                                    (s) =>
                                      `${formatTime(new Date(s.sched_start_time))} - ${formatTime(new Date(s.sched_end_time))}`,
                                  ),
                                ),
                              );
                              return uniqueTimes.length > 0
                                ? uniqueTimes.join(", ")
                                : "None";
                            })()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ) : (
                <Card
                  key={show.show_id}
                  className="overflow-hidden border-sidebar-border h-full"
                >
                  <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                    {show.show_image_key ? (
                      <Image
                        src={show.show_image_key}
                        alt={show.show_name}
                        className="object-cover w-full h-full"
                        width={400}
                        height={225}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                        <Ticket className="w-12 h-12 text-primary/20" />
                      </div>
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg md:text-xl font-semibold line-clamp-1 truncate">
                        {show.show_name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[show.show_status as string] ||
                            "#6B7280",
                          color: "white",
                          borderColor: "transparent",
                        }}
                        className="shadow-sm font-semibold px-3 py-1 text-xs shrink-0"
                      >
                        {show.show_status.replace("_", " ")}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1.5 font-medium text-primary/80">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="line-clamp-1">{show.venue}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">
                          {new Date(show.show_start_date).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                          )}
                          {new Date(show.show_start_date).getTime() !==
                          new Date(show.show_end_date).getTime()
                            ? ` - ${new Date(show.show_end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                            : `, ${new Date(show.show_start_date).getFullYear()}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-sidebar-border">
                      <div className="flex flex-col max-w-full">
                        <span className="text-xs text-muted-foreground font-semibold">
                          Schedules
                        </span>
                        <span className="text-sm font-semibold line-clamp-1 text-primary/90">
                          {(() => {
                            const uniqueTimes = Array.from(
                              new Set(
                                show.scheds.map(
                                  (s) =>
                                    `${formatTime(new Date(s.sched_start_time))} - ${formatTime(new Date(s.sched_end_time))}`,
                                ),
                              ),
                            );
                            return uniqueTimes.length > 0
                              ? uniqueTimes.join(", ")
                              : "None";
                          })()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        )}
      </div>

      <Dialog open={isAssignTeamDialogOpen} onOpenChange={setIsAssignTeamDialogOpen}>
        <DialogContent className="overflow-visible sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign show to a team</DialogTitle>
            <DialogDescription>
              Superadmins must assign a team before creating a show.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2" ref={teamDialogPortalContainerRef}>
            <Combobox
              open={isTeamComboboxOpen}
              onOpenChange={setIsTeamComboboxOpen}
              openOnInputClick
              autoHighlight
              value={selectedTeamName}
              onValueChange={(value) => {
                const nextValue = value ?? "";
                setSelectedTeamName(nextValue);
                const selected = teams.find((team) => team.name === nextValue);
                setSelectedTeamId(selected?.team_id ?? "");
                setTeamSearchQuery(selected?.name ?? "");
                setIsTeamComboboxOpen(false);
              }}
            >
              <ComboboxInput
                aria-label="Search team"
                placeholder="Search or select a team"
                value={teamSearchQuery}
                onFocus={() => setIsTeamComboboxOpen(true)}
                onChange={(event) => {
                  setTeamSearchQuery(event.target.value);
                  setSelectedTeamName("");
                  setSelectedTeamId("");
                  setIsTeamComboboxOpen(true);
                }}
              />
              <ComboboxContent
                className="z-[120]"
                container={teamDialogPortalContainerRef.current}
                side="bottom"
                align="start"
                collisionAvoidance={{
                  side: "none",
                  align: "none",
                  fallbackAxisSide: "none",
                }}
              >
                <ComboboxList className="max-h-80">
                  {isLoadingTeams ? (
                    <ComboboxItem value="loading" disabled>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading teams...
                      </span>
                    </ComboboxItem>
                  ) : filteredTeams.length > 0 ? (
                    filteredTeams.map((team) => (
                      <ComboboxItem key={team.team_id} value={team.name}>
                        {team.name}
                      </ComboboxItem>
                    ))
                  ) : (
                    <ComboboxEmpty>No teams found.</ComboboxEmpty>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignTeamDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTeamAssignment} disabled={!selectedTeamId}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

