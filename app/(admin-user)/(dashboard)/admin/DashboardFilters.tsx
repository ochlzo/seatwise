"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, FilterX, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AdminDashboardFilterOptions,
  NormalizedDashboardFilters,
} from "@/lib/dashboard/types";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

type DashboardFiltersProps = {
  filters: NormalizedDashboardFilters;
  filterOptions: AdminDashboardFilterOptions;
  adminTeamName: string | null;
};

export function DashboardFilters({
  filters,
  filterOptions,
  adminTeamName,
}: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customFrom, setCustomFrom] = React.useState(filters.from);
  const [customTo, setCustomTo] = React.useState(filters.to);

  React.useEffect(() => {
    setCustomFrom(filters.from);
    setCustomTo(filters.to);
  }, [filters.from, filters.to]);

  const pushQuery = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const updateSelect = (key: "range" | "teamId" | "showId", value: string) => {
    pushQuery((params) => {
      if (value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }

      params.delete("recentPage");

      if (key === "range" && value !== "custom") {
        params.delete("from");
        params.delete("to");
      }

      if (key === "teamId") {
        params.delete("showId");
      }
    });
  };

  const applyCustomRange = () => {
    pushQuery((params) => {
      params.set("range", "custom");
      params.delete("recentPage");
      if (customFrom) {
        params.set("from", customFrom);
      } else {
        params.delete("from");
      }
      if (customTo) {
        params.set("to", customTo);
      } else {
        params.delete("to");
      }
    });
  };

  const resetFilters = () => {
    router.push(pathname);
  };

  const filterHeading = filterOptions.canFilterTeams ? "Dashboard filters" : "Team filters";
  const filterSummary = filterOptions.canFilterTeams
    ? "Choose a date range, team, and show to focus this dashboard."
    : `Showing activity for ${adminTeamName ?? "your assigned team"}. Use the date range and show filters to narrow the view.`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            {filterHeading}
          </div>
          <p className="text-sm text-muted-foreground">{filterSummary}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Range</span>
            <Select value={filters.range} onValueChange={(value) => updateSelect("range", value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {filterOptions.canFilterTeams ? (
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Team</span>
              <Select
                value={filters.teamId ?? "all"}
                onValueChange={(value) => updateSelect("teamId", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {filterOptions.teams.map((team) => (
                    <SelectItem key={team.value} value={team.value}>
                      {team.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Show</span>
            <Select
              value={filters.showId ?? "all"}
              onValueChange={(value) => updateSelect("showId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All shows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All shows</SelectItem>
                {filterOptions.shows.map((show) => (
                  <SelectItem key={show.value} value={show.value}>
                    {show.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {filters.range === "custom" ? (
            <>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium">From</span>
                <Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium">To</span>
                <Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
              </label>
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {filters.range === "custom" ? (
            <Button size="sm" onClick={applyCustomRange}>
              <Search className="h-4 w-4" />
              Apply custom range
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={resetFilters}>
            <FilterX className="h-4 w-4" />
            Reset filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
