import { notFound } from "next/navigation";

import AdminShield from "@/components/AdminShield";
import { PageHeader } from "@/components/page-header";
import { AdminWalkInPreparationCard } from "@/components/queue/AdminWalkInPreparationCard";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { prisma } from "@/lib/prisma";

export default async function AdminWalkInSchedulePage({
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
    select: {
      sched_id: true,
      sched_date: true,
      sched_start_time: true,
      sched_end_time: true,
      show: {
        select: {
          show_id: true,
          show_name: true,
          venue: true,
        },
      },
    },
  });

  if (!schedule) {
    notFound();
  }

  const scheduleLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(schedule.sched_start_time);

  return (
    <>
      <PageHeader
        title="Walk-In"
        parentLabel={schedule.show.show_name}
        parentHref={`/admin/shows/${schedule.show.show_id}`}
        breadcrumbLabelOverrides={{
          [schedule.show.show_id]: schedule.show.show_name,
          [schedule.sched_id]: scheduleLabel,
        }}
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="relative flex flex-1 flex-col bg-background">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-8 pt-0">
          <AdminWalkInPreparationCard
            showId={showId}
            schedId={schedId}
          />
        </div>
      </div>
    </>
  );
}
