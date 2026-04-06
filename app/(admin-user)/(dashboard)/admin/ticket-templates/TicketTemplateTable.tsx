"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { Eye, FileText, Loader2, Pencil, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import type { TicketTemplateListItem } from "@/lib/db/TicketTemplates";
import {
  formatTicketShowDate,
  formatTicketShowTime,
} from "@/lib/tickets/ticketDateTime";

type TicketTemplateTableProps = {
  ticketTemplates: TicketTemplateListItem[];
};

type TicketTemplateVersionOption = {
  ticketTemplateVersionId: string;
  versionNumber: number;
  createdAt: string;
  previewUrl: string | null;
};

type VersionMenuState = {
  isLoading: boolean;
  versions: TicketTemplateVersionOption[];
  liveVersionId: string | null;
  error: string | null;
};

type TestOutputDraft = {
  showName: string;
  venue: string;
  showDate: Date | null;
  showTime: string;
  seatCategory: string;
  price: string;
  seatNumber: string;
  customerName: string;
  referenceNumber: string;
};

const createTestOutputDraft = (): TestOutputDraft => ({
  showName: "",
  venue: "",
  showDate: null,
  showTime: "19:30",
  seatCategory: "",
  price: "",
  seatNumber: "",
  customerName: "",
  referenceNumber: String(Math.floor(1000 + Math.random() * 9000)),
});

const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function TicketTemplateTable({
  ticketTemplates,
}: TicketTemplateTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = React.useState(ticketTemplates);
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");
  const [previewTemplateId, setPreviewTemplateId] = React.useState<
    string | null
  >(null);
  const [testOutputTemplateId, setTestOutputTemplateId] = React.useState<
    string | null
  >(null);
  const [versionStates, setVersionStates] = React.useState<
    Record<string, VersionMenuState | undefined>
  >({});
  const [switchingTemplateId, setSwitchingTemplateId] = React.useState<
    string | null
  >(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [testOutputDraft, setTestOutputDraft] = React.useState<TestOutputDraft>(
    createTestOutputDraft,
  );

  React.useEffect(() => {
    setRows(ticketTemplates);
  }, [ticketTemplates]);

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
    router.push(nextSearch ? `?${nextSearch}` : "/admin/ticket-templates", {
      scroll: false,
    });
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery(query.trim(), searchParams.get("sort"));
  };

  const loadVersionsForTemplate = React.useCallback(
    async (ticketTemplateId: string) => {
      setVersionStates((prev) => ({
        ...prev,
        [ticketTemplateId]: {
          isLoading: true,
          versions: prev[ticketTemplateId]?.versions ?? [],
          liveVersionId: prev[ticketTemplateId]?.liveVersionId ?? null,
          error: null,
        },
      }));

      try {
        const response = await fetch(
          `/api/ticket-templates/${ticketTemplateId}`,
        );
        const data = (await response.json()) as {
          success?: boolean;
          error?: string;
          ticketTemplate?: {
            versions?: Array<{
              ticket_template_version_id: string;
              version_number: number;
              createdAt: string;
              template_schema?: {
                previewUrl?: string;
              };
            }>;
            liveTicketTemplateVersionId?: string | null;
          };
        };

        if (!response.ok || !data.success || !data.ticketTemplate) {
          throw new Error(data.error || "Failed to load template versions.");
        }

        const versions = (data.ticketTemplate.versions ?? []).map(
          (version) => ({
            ticketTemplateVersionId: version.ticket_template_version_id,
            versionNumber: version.version_number,
            createdAt: version.createdAt,
            previewUrl:
              typeof version.template_schema?.previewUrl === "string"
                ? version.template_schema.previewUrl
                : null,
          }),
        );

        setVersionStates((prev) => ({
          ...prev,
          [ticketTemplateId]: {
            isLoading: false,
            versions,
            liveVersionId:
              data.ticketTemplate?.liveTicketTemplateVersionId ?? null,
            error: null,
          },
        }));
      } catch (error) {
        setVersionStates((prev) => ({
          ...prev,
          [ticketTemplateId]: {
            isLoading: false,
            versions: prev[ticketTemplateId]?.versions ?? [],
            liveVersionId: prev[ticketTemplateId]?.liveVersionId ?? null,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load template versions.",
          },
        }));
      }
    },
    [],
  );

  const setLiveVersion = React.useCallback(
    async (ticketTemplateId: string, ticketTemplateVersionId: string) => {
      setSwitchingTemplateId(ticketTemplateId);

      try {
        const response = await fetch(
          `/api/ticket-templates/${ticketTemplateId}/live-version`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ticketTemplateVersionId }),
          },
        );

        const data = (await response.json()) as {
          success?: boolean;
          error?: string;
          ticketTemplate?: {
            liveTicketTemplateVersionId?: string | null;
            liveVersionNumber?: number | null;
            liveVersionCreatedAt?: string | null;
            liveVersionPreviewUrl?: string | null;
          };
        };

        if (!response.ok || !data.success || !data.ticketTemplate) {
          throw new Error(data.error || "Failed to update live version.");
        }

        setRows((prev) =>
          prev.map((row) =>
            row.ticket_template_id === ticketTemplateId
              ? {
                  ...row,
                  liveTicketTemplateVersionId:
                    data.ticketTemplate?.liveTicketTemplateVersionId ?? null,
                  liveVersionNumber:
                    data.ticketTemplate?.liveVersionNumber ?? null,
                  liveVersionCreatedAt: data.ticketTemplate
                    ?.liveVersionCreatedAt
                    ? new Date(data.ticketTemplate.liveVersionCreatedAt)
                    : null,
                  liveVersionPreviewUrl:
                    data.ticketTemplate?.liveVersionPreviewUrl ?? null,
                }
              : row,
          ),
        );

        setVersionStates((prev) => ({
          ...prev,
          [ticketTemplateId]: prev[ticketTemplateId]
            ? {
                ...prev[ticketTemplateId],
                liveVersionId: ticketTemplateVersionId,
              }
            : prev[ticketTemplateId],
        }));

        toast.success("Live ticket version updated.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update live version.",
        );
      } finally {
        setSwitchingTemplateId(null);
      }
    },
    [],
  );

  const previewTemplate = rows.find(
    (row) => row.ticket_template_id === previewTemplateId,
  );
  const testOutputTemplate = rows.find(
    (row) => row.ticket_template_id === testOutputTemplateId,
  );

  const openTestOutput = React.useCallback((ticketTemplateId: string) => {
    setTestOutputTemplateId(ticketTemplateId);
    setTestOutputDraft(createTestOutputDraft());
  }, []);

  const generateTestPdf = React.useCallback(async () => {
    if (!testOutputTemplate) {
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const response = await fetch(
        `/api/ticket-templates/${testOutputTemplate.ticket_template_id}/test-output`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ticketTemplateVersionId:
              testOutputTemplate.liveTicketTemplateVersionId ?? undefined,
            showName: testOutputDraft.showName,
            venue: testOutputDraft.venue,
            showDate: testOutputDraft.showDate
              ? formatLocalDateKey(testOutputDraft.showDate)
              : "",
            showTime: testOutputDraft.showTime,
            seatCategory: testOutputDraft.seatCategory,
            price: testOutputDraft.price,
            seatNumber: testOutputDraft.seatNumber,
            customerName: testOutputDraft.customerName,
            referenceNumber: testOutputDraft.referenceNumber,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Failed to generate the PDF ticket.");
      }

      const pdfBlob = await response.blob();
      const contentDisposition =
        response.headers.get("content-disposition") ?? "";
      const filenameMatch = contentDisposition.match(
        /filename=\"?([^\";]+)\"?/i,
      );
      const filename =
        filenameMatch?.[1] ??
        `Test Ticket Output - ${testOutputTemplate.template_name}.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setTestOutputTemplateId(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate the PDF ticket.",
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [testOutputDraft, testOutputTemplate]);

  return (
    <>
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
              onChange={(event) =>
                updateQuery(query.trim(), event.target.value)
              }
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
                <th className="px-4 py-3 text-left font-semibold">
                  Live Version
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Created On
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Updated On
                </th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-muted-foreground"
                  >
                    No ticket templates found.
                  </td>
                </tr>
              ) : (
                rows.map((template) => (
                  <tr
                    key={template.ticket_template_id}
                    className="border-t border-sidebar-border"
                  >
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {template.template_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {template.versionCount} saved version
                          {template.versionCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {template.liveVersionNumber
                        ? `v${template.liveVersionNumber}`
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[220px]"
                          >
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/ticket-builder?ticketTemplateId=${template.ticket_template_id}${template.liveTicketTemplateVersionId ? `&ticketTemplateVersionId=${template.liveTicketTemplateVersionId}` : ""}`}
                              >
                                Edit Ticket
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSub
                              onOpenChange={(open) => {
                                if (!open) return;
                                void loadVersionsForTemplate(
                                  template.ticket_template_id,
                                );
                              }}
                            >
                              <DropdownMenuSubTrigger>
                                Select Version
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent className="w-[280px]">
                                  {versionStates[template.ticket_template_id]
                                    ?.isLoading ? (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                      Loading versions...
                                    </div>
                                  ) : versionStates[template.ticket_template_id]
                                      ?.error ? (
                                    <div className="px-2 py-1.5 text-sm text-destructive">
                                      {
                                        versionStates[
                                          template.ticket_template_id
                                        ]?.error
                                      }
                                    </div>
                                  ) : (
                                    <DropdownMenuRadioGroup
                                      value={
                                        versionStates[
                                          template.ticket_template_id
                                        ]?.liveVersionId ?? ""
                                      }
                                      onValueChange={(value) => {
                                        if (switchingTemplateId) return;
                                        void setLiveVersion(
                                          template.ticket_template_id,
                                          value,
                                        );
                                      }}
                                    >
                                      {(
                                        versionStates[
                                          template.ticket_template_id
                                        ]?.versions ?? []
                                      ).map((version) => (
                                        <DropdownMenuRadioItem
                                          key={version.ticketTemplateVersionId}
                                          value={
                                            version.ticketTemplateVersionId
                                          }
                                          disabled={
                                            switchingTemplateId ===
                                            template.ticket_template_id
                                          }
                                        >
                                          {`v${version.versionNumber} • ${format(
                                            new Date(version.createdAt),
                                            "PP p",
                                          )}`}
                                        </DropdownMenuRadioItem>
                                      ))}
                                    </DropdownMenuRadioGroup>
                                  )}
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="mr-2 h-4 w-4" />
                              Preview
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[220px]"
                          >
                            <DropdownMenuItem
                              onClick={() =>
                                setPreviewTemplateId(
                                  template.ticket_template_id,
                                )
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Preview Template
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                openTestOutput(template.ticket_template_id)
                              }
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Test Output
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog
        open={Boolean(previewTemplate)}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplateId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-[960px] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {previewTemplate?.template_name ?? "Ticket Preview"}
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.liveVersionNumber
                ? `Live version v${previewTemplate.liveVersionNumber}`
                : "No live version selected."}
            </DialogDescription>
          </DialogHeader>
          {previewTemplate?.liveVersionPreviewUrl ? (
            <div className="overflow-auto rounded-md border border-sidebar-border bg-muted/20 p-3">
              <Image
                src={previewTemplate.liveVersionPreviewUrl}
                alt={`${previewTemplate.template_name} preview`}
                width={2550}
                height={825}
                className="h-auto w-full rounded-md object-contain"
              />
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-sidebar-border p-8 text-center text-sm text-muted-foreground">
              No PNG preview is available for this live version yet.
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(testOutputTemplate)}
        onOpenChange={(open) => {
          if (open) return;
          if (isGeneratingPdf) return;
          setTestOutputTemplateId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Test Output{" "}
              {testOutputTemplate?.template_name
                ? `- ${testOutputTemplate.template_name}`
                : ""}
            </DialogTitle>
            <DialogDescription>
              Enter sample data to generate a PDF using the live ticket
              rendering pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="showName">Show Name</Label>
              <Input
                id="showName"
                value={testOutputDraft.showName}
                onChange={(event) =>
                  setTestOutputDraft((current) => ({
                    ...current,
                    showName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                value={testOutputDraft.venue}
                onChange={(event) =>
                  setTestOutputDraft((current) => ({
                    ...current,
                    venue: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Show Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start font-normal"
                  >
                    {testOutputDraft.showDate
                      ? formatTicketShowDate(testOutputDraft.showDate)
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="z-[10020] w-auto p-0 shadow-lg"
                >
                  <Calendar
                    mode="single"
                    selected={testOutputDraft.showDate ?? undefined}
                    onSelect={(date) => {
                      setTestOutputDraft((current) => ({
                        ...current,
                        showDate: date ?? null,
                      }));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="showTime">Show Time</Label>
              <Input
                id="showTime"
                type="time"
                value={testOutputDraft.showTime}
                onChange={(event) =>
                  setTestOutputDraft((current) => ({
                    ...current,
                    showTime: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Will render as {formatTicketShowTime(testOutputDraft.showTime)} in the PDF.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="seatCategory">Seat Category</Label>
              <Input
                id="seatCategory"
                value={testOutputDraft.seatCategory}
                onChange={(event) =>
                  setTestOutputDraft((current) => ({
                    ...current,
                    seatCategory: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                value={testOutputDraft.price}
                onChange={(event) =>
                  setTestOutputDraft((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="seatNumber">Seat Number</Label>
              <Input
                id="seatNumber"
                value={testOutputDraft.seatNumber}
                onChange={(event) =>
                  setTestOutputDraft((current) => ({
                    ...current,
                    seatNumber: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={testOutputDraft.customerName}
                onChange={(event) =>
                  setTestOutputDraft((current) => ({
                    ...current,
                    customerName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2 md:col-span-2 md:max-w-xs">
              <Label htmlFor="referenceNumber">Reference Number</Label>
              <Input
                id="referenceNumber"
                value={testOutputDraft.referenceNumber}
                readOnly
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestOutputTemplateId(null)}
              disabled={isGeneratingPdf}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void generateTestPdf()}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                "Generate PDF"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
