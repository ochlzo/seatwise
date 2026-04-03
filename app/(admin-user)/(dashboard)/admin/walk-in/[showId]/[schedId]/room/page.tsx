import { notFound } from "next/navigation";
import type { SeatStatus, ShowStatus, SchedStatus } from "@prisma/client";

import AdminShield from "@/components/AdminShield";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { prisma } from "@/lib/prisma";
import { ReserveSeatClient } from "@/app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient";

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

export default async function AdminWalkInRoomPage({
  params,
}: {
  params: Promise<{ showId: string; schedId: string }>;
}) {
  const { showId, schedId } = await params;
  const adminContext = await getCurrentAdminContext();

  const schedule = await prisma.sched.findFirst({
    where: {
      sched_id: schedId,
      show_id: showId,
      show: adminContext.isSuperadmin
        ? undefined
        : { team_id: adminContext.teamId ?? "__NO_TEAM__" },
    },
    include: {
        show: {
          select: {
            show_id: true,
            show_name: true,
            show_status: true,
            seatmap_id: true,
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
  });

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
        title="Walk-In Reservation"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Admin Dashboard", href: "/admin" },
          { label: "Shows", href: "/admin/shows" },
          {
            label: schedule.show.show_name,
            href: `/admin/shows/${schedule.show.show_id}`,
          },
          { label: "Walk-In Room" },
        ]}
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="relative flex flex-1 flex-col bg-background">
        <ReserveSeatClient
          mode="walk_in"
          showId={showId}
          schedId={schedId}
          queueParticipantId={adminContext.userId}
          returnHref={`/admin/shows/${schedule.show.show_id}`}
          seatmapId={schedule.show.seatmap_id}
          seatmapCategories={seatmapCategories}
          seatCategoryAssignments={seatCategoryAssignments}
          seatNumbersById={seatNumbersById}
          seatStatusById={seatStatusById}
          initialShowName={schedule.show.show_name}
          initialScheduleSnapshot={scheduleSnapshot}
        />
      </div>
    </>
  );
}
