import { notFound } from "next/navigation";

import AdminShield from "@/components/AdminShield";
import { PageHeader } from "@/components/page-header";
import { TicketManagerPageClient } from "@/components/tickets/TicketManagerPageClient";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { prisma } from "@/lib/prisma";
import {
  buildTicketManagerRows,
  buildTicketManagerSchedules,
} from "@/lib/tickets/ticketManager";

export default async function AdminShowTicketManagerPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;

  const [adminContext, show] = await Promise.all([
    getCurrentAdminContext(),
    prisma.show.findUnique({
      where: { show_id: showId },
      select: {
        show_id: true,
        show_name: true,
        show_description: true,
        team_id: true,
        scheds: {
          select: {
            sched_id: true,
            sched_date: true,
            sched_start_time: true,
          },
          orderBy: [{ sched_date: "asc" }, { sched_start_time: "asc" }],
        },
        reservations: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            reservation_id: true,
            reservation_number: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            sched_id: true,
            ticket_issued_at: true,
            sched: {
              select: {
                sched_id: true,
                sched_date: true,
                sched_start_time: true,
              },
            },
            reservedSeats: {
              select: {
                seatAssignment: {
                  select: {
                    seat_assignment_id: true,
                    seat_status: true,
                    seat: {
                      select: {
                        seat_number: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!show) {
    notFound();
  }

  if (!adminContext.isSuperadmin && show.team_id !== adminContext.teamId) {
    notFound();
  }

  const schedules = buildTicketManagerSchedules(show.scheds);
  const rows = buildTicketManagerRows(show.reservations);

  return (
    <>
      <PageHeader
        title="Ticket Manager"
        breadcrumbLabelOverrides={{
          [show.show_id]: show.show_name,
        }}
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <TicketManagerPageClient
        showName={show.show_name}
        description="Review ticket issuance and seat-level entry status for every reservation in this production."
        rows={rows}
        schedules={schedules}
      />
    </>
  );
}
