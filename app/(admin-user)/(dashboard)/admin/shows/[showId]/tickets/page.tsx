import { notFound } from "next/navigation";

import AdminShield from "@/components/AdminShield";
import { PageHeader } from "@/components/page-header";
import { TicketManagerPageClient } from "@/components/tickets/TicketManagerPageClient";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { prisma } from "@/lib/prisma";
import { getTicketManagerStatus, type TicketManagerRow } from "@/lib/tickets/ticketManager";

const MANILA_TIME_ZONE = "Asia/Manila";

function formatScheduleLabel(dateValue: Date, startTimeValue: Date) {
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startTimeValue));

  return `${dateLabel} at ${timeLabel}`;
}

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

  const schedules = show.scheds.map((schedule) => ({
    schedId: schedule.sched_id,
    label: formatScheduleLabel(schedule.sched_date, schedule.sched_start_time),
  }));

  const rows: TicketManagerRow[] = show.reservations.flatMap((reservation) => {
    const guestName = `${reservation.first_name} ${reservation.last_name}`.trim();
    const scheduleLabel = formatScheduleLabel(
      reservation.sched.sched_date,
      reservation.sched.sched_start_time,
    );

    return reservation.reservedSeats.map(({ seatAssignment }) => ({
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      schedId: reservation.sched_id,
      scheduleLabel,
      seatAssignmentId: seatAssignment.seat_assignment_id,
      seatLabel: seatAssignment.seat.seat_number,
      guestName,
      guestEmail: reservation.email,
      guestPhoneNumber: reservation.phone_number,
      ticketStatus: getTicketManagerStatus(
        reservation.ticket_issued_at,
        seatAssignment.seat_status,
      ),
      issuedAt: reservation.ticket_issued_at?.toISOString() ?? null,
    }));
  });

  return (
    <>
      <PageHeader
        title="Ticket Manager"
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
