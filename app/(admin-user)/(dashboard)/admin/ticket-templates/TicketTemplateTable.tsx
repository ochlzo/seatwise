"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { TicketTemplateListItem } from "@/lib/db/TicketTemplates";

type TicketTemplateTableProps = {
  ticketTemplates: TicketTemplateListItem[];
};

export function TicketTemplateTable({ ticketTemplates }: TicketTemplateTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");

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
    const nextSearch = params.toString();
    router.push(
      nextSearch ? `?${nextSearch}` : "/admin/ticket-templates",
      { scroll: false },
    );
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery(query.trim(), searchParams.get("sort"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="flex w-full items-center gap-2 md:max-w-md"
        >
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ticket templates..."
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={searchParams.get("sort") ?? "newest"}
            onChange={(event) => updateQuery(query.trim(), event.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <Button asChild>
            <Link href="/ticket-builder">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-sidebar-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Template</th>
              <th className="px-4 py-3 text-left font-semibold">Latest Version</th>
              <th className="px-4 py-3 text-left font-semibold">Created On</th>
              <th className="px-4 py-3 text-left font-semibold">Updated On</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ticketTemplates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  No ticket templates found.
                </td>
              </tr>
            ) : (
              ticketTemplates.map((template) => (
                <tr
                  key={template.ticket_template_id}
                  className="border-t border-sidebar-border"
                >
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold">{template.template_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {template.versionCount} saved version
                        {template.versionCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {template.latestVersionNumber
                      ? `v${template.latestVersionNumber}`
                      : "No versions yet"}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {format(new Date(template.createdAt), "PP p")}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {format(new Date(template.updatedAt), "PP p")}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/ticket-builder?ticketTemplateId=${template.ticket_template_id}`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/ticket-builder?ticketTemplateId=${template.ticket_template_id}`}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
