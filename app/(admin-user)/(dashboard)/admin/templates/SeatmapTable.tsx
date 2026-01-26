"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Check, Trash2, Ban, CheckCircle2, Pencil, ExternalLink, CalendarSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import { deleteSeatmapsAction, updateSeatmapStatusAction } from "@/lib/actions/seatmapActions";
import { toast } from "sonner";

type SeatmapRow = {
  seatmap_id: string;
  seatmap_name: string;
  seatmap_json: any;
  seatmap_status: "ACTIVE" | "DISABLED";
  updatedAt: string | Date;
  sched: {
    show: {
      show_id: string;
      show_name: string;
      venue: string;
    };
  };
};

type SeatmapTableProps = {
  seatmaps: SeatmapRow[];
};

export function SeatmapTable({ seatmaps }: SeatmapTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");

  const allSelected = selectedIds.length > 0 && selectedIds.length === seatmaps.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(seatmaps.map((seatmap) => seatmap.seatmap_id));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const updateQuery = (nextQuery: string, sortValue?: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextQuery) {
      params.set("q", nextQuery);
    } else {
      params.delete("q");
    }
    if (sortValue && sortValue !== "newest") {
      params.set("sort", sortValue);
    } else {
      params.delete("sort");
    }
    router.push(`?${params.toString()}`);
  };

  const handleSortChange = (value: string) => {
    updateQuery(query.trim(), value);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery(query.trim(), searchParams.get("sort"));
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const result = await deleteSeatmapsAction(selectedIds);
    if (!result.success) {
      toast.error(result.error || "Failed to delete seatmaps");
      return;
    }
    toast.success("Seatmaps deleted");
    setSelectedIds([]);
    router.refresh();
  };

  const handleBulkStatus = async (status: "ACTIVE" | "DISABLED") => {
    if (!selectedIds.length) return;
    const result = await updateSeatmapStatusAction(selectedIds, status);
    if (!result.success) {
      toast.error(result.error || "Failed to update seatmaps");
      return;
    }
    toast.success(status === "ACTIVE" ? "Seatmaps enabled" : "Seatmaps disabled");
    setSelectedIds([]);
    router.refresh();
  };

  const handleRowStatus = async (id: string, status: "ACTIVE" | "DISABLED") => {
    const result = await updateSeatmapStatusAction([id], status);
    if (!result.success) {
      toast.error(result.error || "Failed to update seatmap");
      return;
    }
    toast.success(status === "ACTIVE" ? "Seatmap enabled" : "Seatmap disabled");
    router.refresh();
  };

  const handleRowDelete = async (id: string) => {
    const result = await deleteSeatmapsAction([id]);
    if (!result.success) {
      toast.error(result.error || "Failed to delete seatmap");
      return;
    }
    toast.success("Seatmap deleted");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="flex w-full items-center gap-2 md:max-w-md">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by seatmap, show, or venue..."
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
          />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <select
            value={searchParams.get("sort") ?? "newest"}
            onChange={(event) => handleSortChange(event.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus("ACTIVE")}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Enable
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkStatus("DISABLED")}>
                <Ban className="mr-2 h-4 w-4" />
                Disable
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-sidebar-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-primary"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold">Seatmap</th>
              <th className="px-4 py-3 text-left font-semibold">JSON Size</th>
              <th className="px-4 py-3 text-left font-semibold">Updated On</th>
              <th className="px-4 py-3 text-left font-semibold">Events</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {seatmaps.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                  No seatmaps found.
                </td>
              </tr>
            )}
            {seatmaps.map((seatmap) => {
              const jsonBytes = new Blob([JSON.stringify(seatmap.seatmap_json)]).size;
              const updatedOn = format(new Date(seatmap.updatedAt), "PP");
              const isDisabled = seatmap.seatmap_status === "DISABLED";
              return (
                <tr
                  key={seatmap.seatmap_id}
                  className={cn("border-t border-sidebar-border", isDisabled && "opacity-60")}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(seatmap.seatmap_id)}
                      onChange={() => toggleOne(seatmap.seatmap_id)}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold">{seatmap.seatmap_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {seatmap.sched.show.show_name} · {seatmap.sched.show.venue}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{formatBytes(jsonBytes)}</td>
                  <td className="px-4 py-4 text-muted-foreground">{updatedOn}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <CalendarSearch className="h-4 w-4" />
                      1
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/templates/${seatmap.seatmap_id}`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/seat-builder">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/shows/${seatmap.sched.show.show_id}`}>
                          <CalendarSearch className="mr-2 h-4 w-4" />
                          Events
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleRowStatus(
                            seatmap.seatmap_id,
                            seatmap.seatmap_status === "ACTIVE" ? "DISABLED" : "ACTIVE"
                          )
                        }
                      >
                        {seatmap.seatmap_status === "ACTIVE" ? (
                          <>
                            <Ban className="mr-2 h-4 w-4" />
                            Disable
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Enable
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRowDelete(seatmap.seatmap_id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
