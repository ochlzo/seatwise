import { notFound } from "next/navigation";

import AdminShield from "@/components/AdminShield";
import { AdminTicketScanner } from "@/components/tickets/AdminTicketScanner";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { getShowById } from "@/lib/db/Shows";

const formatScheduleLabel = (dateValue: Date, startValue: Date) => {
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateValue));
  const timeLabel = new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startValue));

  return `${dateLabel} at ${timeLabel}`;
};

export default async function AdminShowScannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ showId: string }>;
  searchParams: Promise<{ schedId?: string }>;
}) {
  const { showId } = await params;
  const { schedId } = await searchParams;
  const show = await getShowById(showId);

  if (!show) {
    notFound();
  }

  const adminContext = await getCurrentAdminContext();

  if (!adminContext.isSuperadmin && show.team_id !== adminContext.teamId) {
    notFound();
  }

  const selectedSchedule = show.scheds.find((schedule) => schedule.sched_id === schedId);

  if (!schedId || !selectedSchedule?.sched_id) {
    notFound();
  }

  const categoriesById = new Map<
    string,
    {
      category_id: string;
      name: string;
      color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
      price: string;
    }
  >();
  const seatCategoryAssignments: Record<string, string> = {};
  const seatStatusById: Record<
    string,
    (typeof selectedSchedule.seatAssignments)[number]["seat_status"]
  > = {};

  selectedSchedule.seatAssignments.forEach((assignment) => {
    const categoryId = assignment.set.seat_category_id;
    seatCategoryAssignments[assignment.seat_id] = categoryId;
    seatStatusById[assignment.seat_id] = assignment.seat_status;

    if (!categoriesById.has(categoryId)) {
      categoriesById.set(categoryId, {
        category_id: categoryId,
        name: assignment.set.seatCategory.category_name,
        color_code: assignment.set.seatCategory.color_code,
        price: assignment.set.seatCategory.price.toString(),
      });
    }
  });

  const schedule = {
    schedId: selectedSchedule.sched_id,
    label: formatScheduleLabel(
      selectedSchedule.sched_date,
      selectedSchedule.sched_start_time,
    ),
    seatmapCategories: Array.from(categoriesById.values()),
    seatCategoryAssignments,
    seatStatusById,
  };

  return (
    <>
      <PageHeader
        title="Ticket Scanner"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col px-3 pb-6 pt-0 md:max-w-[1160px] md:px-8">
        <AdminTicketScanner
          showId={show.show_id}
          schedId={schedule.schedId}
          seatmapId={show.seatmap_id}
          schedule={schedule}
        />
      </div>
    </>
  );
}
