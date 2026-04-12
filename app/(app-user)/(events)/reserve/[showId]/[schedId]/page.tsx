import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { ReserveSeatClient } from "./ReserveSeatClient";
import { notFound } from "next/navigation";
import type { SeatStatus, ShowStatus, SchedStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getShowTicketDesigns, type ShowTicketDesign } from "@/lib/tickets/getShowTicketDesigns";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

type SeatmapCategoryPayload = {
  category_id: string;
  name: string;
  color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
  price: string;
};

type SeatStatusPayload = SeatStatus;

type ReserveScheduleSnapshot = {
  schedId: string;
  schedDate: string;
  schedStartTime: string;
  schedEndTime: string;
  schedStatus: SchedStatus | null;
  showName: string;
  showStatus: ShowStatus;
};

export default async function ReserveSeatPage({
  params,
  searchParams,
}: {
  params: Promise<{ showId: string; schedId: string }>;
  searchParams?: Promise<{ accessMode?: string }>;
}) {
  const { showId, schedId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const accessMode =
    resolvedSearchParams?.accessMode === "dry-run" ? "dry-run" : "default";

  const [schedule, initialTicketDesigns] = await Promise.all([
    prisma.sched.findFirst({
      where: {
        sched_id: schedId,
        show_id: showId,
      },
      include: {
        show: {
          select: {
            show_name: true,
            show_status: true,
            seatmap_id: true,
            gcash_qr_image_key: true,
            gcash_number: true,
            gcash_account_name: true,
          },
        },
        seatAssignments: {
          select: {
            seat_id: true,
            seat_status: true,
            seat: {
              select: {
                seat_number: true,
              },
            },
            set: {
              select: {
                seat_category_id: true,
                seatCategory: {
                  select: {
                    category_name: true,
                    color_code: true,
                    price: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    getShowTicketDesigns(showId),
  ]);

  if (!schedule) {
    notFound();
  }

  const categoriesById = new Map<string, SeatmapCategoryPayload>();
  const seatCategoryAssignments: Record<string, string> = {};
  const seatNumbersById: Record<string, string> = {};
  const seatStatusById: Record<string, SeatStatusPayload> = {};

  for (const assignment of schedule.seatAssignments) {
    const categoryId = assignment.set.seat_category_id;
    seatCategoryAssignments[assignment.seat_id] = categoryId;
    seatNumbersById[assignment.seat_id] = assignment.seat.seat_number;
    seatStatusById[assignment.seat_id] = assignment.seat_status;

    if (!categoriesById.has(categoryId)) {
      categoriesById.set(categoryId, {
        category_id: categoryId,
        name: assignment.set.seatCategory.category_name,
        color_code: assignment.set.seatCategory.color_code,
        price: assignment.set.seatCategory.price.toString(),
      });
    }
  }

  const seatmapCategories = Array.from(categoriesById.values());
  const scheduleSnapshot: ReserveScheduleSnapshot = {
    schedId: schedule.sched_id,
    schedDate: schedule.sched_date.toISOString(),
    schedStartTime: schedule.sched_start_time.toISOString(),
    schedEndTime: schedule.sched_end_time.toISOString(),
    schedStatus: schedule.status,
    showName: schedule.show.show_name,
    showStatus: schedule.show.show_status,
  };

  return (
    <>
      <PageHeader
        title="Reserve Seats"
        parentLabel={schedule.show.show_name}
        parentHref={accessMode === "dry-run" ? `/dry-run/${showId}` : `/${showId}`}
        rightSlot={<ThemeSwithcer />}
      />
      <div className="relative flex flex-1 flex-col bg-background">
        <ReserveSeatClient
          showId={showId}
          schedId={schedId}
          seatmapId={schedule.show.seatmap_id}
          gcashQrImageKey={schedule.show.gcash_qr_image_key}
          gcashNumber={schedule.show.gcash_number}
          gcashAccountName={schedule.show.gcash_account_name}
          seatmapCategories={seatmapCategories}
          seatCategoryAssignments={seatCategoryAssignments}
          seatNumbersById={seatNumbersById}
          seatStatusById={seatStatusById}
          initialShowName={schedule.show.show_name}
          initialScheduleSnapshot={scheduleSnapshot}
          initialTicketDesigns={initialTicketDesigns as ShowTicketDesign[]}
          accessMode={accessMode}
        />
      </div>
    </>
  );
}
