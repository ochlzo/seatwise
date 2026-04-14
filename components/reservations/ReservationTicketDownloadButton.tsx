"use client";

import * as React from "react";
import { ChevronDown, Download, FileDown, Loader2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

type SeatDownload = {
  seatAssignmentId: string;
  seatLabel: string;
};

type ReservationTicketDownloadButtonProps = {
  reservationId: string;
  reservationNumber: string;
  seatDownloads: SeatDownload[];
  className?: string;
};

const buildDownloadTicketsHref = (
  reservationId: string,
  seatAssignmentId?: string,
) => {
  const params = new URLSearchParams({ reservationId });
  if (seatAssignmentId) {
    params.set("seatAssignmentId", seatAssignmentId);
  }

  return `/api/reservations/download-tickets?${params.toString()}`;
};

export function ReservationTicketDownloadButton({
  reservationId,
  reservationNumber,
  seatDownloads,
  className,
}: ReservationTicketDownloadButtonProps) {
  const seatCount = seatDownloads.length;
  const primaryHref = buildDownloadTicketsHref(reservationId);
  const zipLabel = seatCount === 1 ? "Download PDF" : "Download ZIP";
  const [downloadingKey, setDownloadingKey] = React.useState<string | null>(null);

  if (seatCount === 0) {
    return null;
  }

  const extractFilename = (contentDisposition: string | null, fallback: string) => {
    if (!contentDisposition) return fallback;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }

    const fallbackMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return fallbackMatch?.[1] || fallback;
  };

  const downloadTicket = async (href: string, fallbackFilename: string, key: string) => {
    if (downloadingKey) return;

    setDownloadingKey(key);
    try {
      const response = await fetch(href, { method: "GET" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        throw new Error(payload?.error || payload?.message || "Failed to download ticket.");
      }

      const blob = await response.blob();
      const filename = extractFilename(
        response.headers.get("content-disposition"),
        fallbackFilename,
      );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download ticket.");
    } finally {
      setDownloadingKey((current) => (current === key ? null : current));
    }
  };

  if (seatCount === 1) {
    const seat = seatDownloads[0]!;

    return (
      <Button
        type="button"
        variant="outline"
        className={className}
        title={`Download PDF for Seat ${seat.seatLabel}`}
        disabled={Boolean(downloadingKey)}
        onClick={() =>
          void downloadTicket(
            buildDownloadTicketsHref(reservationId, seat.seatAssignmentId),
            `seatwise-ticket-${seat.seatLabel}-${reservationNumber}.pdf`,
            seat.seatAssignmentId,
          )
        }
      >
        {downloadingKey ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Download PDF
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className={className}
        disabled={Boolean(downloadingKey)}
        onClick={() =>
          void downloadTicket(
            primaryHref,
            `seatwise-tickets-${reservationNumber}.zip`,
            "zip",
          )
        }
      >
        {downloadingKey === "zip" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {zipLabel}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label={`Open download options for reservation ${reservationNumber}`}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Download options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              void downloadTicket(
                primaryHref,
                `seatwise-tickets-${reservationNumber}.zip`,
                "zip",
              )
            }
          >
            <FileDown className="h-4 w-4" />
            Download all as ZIP
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Individual PDFs</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-60">
              {seatDownloads.map((seat) => (
                <DropdownMenuItem
                  key={seat.seatAssignmentId}
                  onSelect={() =>
                    void downloadTicket(
                      buildDownloadTicketsHref(reservationId, seat.seatAssignmentId),
                      `seatwise-ticket-${seat.seatLabel}-${reservationNumber}.pdf`,
                      seat.seatAssignmentId,
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Seat {seat.seatLabel}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
