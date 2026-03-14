import "server-only";

import { ReservationStatus, type Prisma, type ShowStatus } from "@prisma/client";
import { closeQueueChannel } from "@/lib/queue/closeQueue";
import { initializeQueueChannel } from "@/lib/queue/initializeQueue";

const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

const isCloseLikeStatus = (status: ShowStatus) =>
  status === "CLOSED" || status === "CANCELLED";

const isTransitioningToClosedStatus = (
  oldStatus: ShowStatus | null | undefined,
  newStatus: ShowStatus,
) => isCloseLikeStatus(newStatus) && (!oldStatus || !isCloseLikeStatus(oldStatus));

export async function assertShowCanMoveToClosedStatus(
  db: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  showId: string,
  nextStatus: ShowStatus,
) {
  if (!isCloseLikeStatus(nextStatus)) {
    return;
  }

  const blockingReservationCount = await db.reservation.count({
    where: {
      show_id: showId,
      status: {
        in: BLOCKING_RESERVATION_STATUSES,
      },
    },
  });

  if (blockingReservationCount > 0) {
    throw new Error(
      `This show has ${blockingReservationCount} pending or confirmed reservation(s). Resolve those bookings before changing the status to ${nextStatus}.`,
    );
  }
}

export async function runShowQueueStatusTransition({
  showId,
  oldStatus,
  newStatus,
  schedIds,
}: {
  showId: string;
  oldStatus: ShowStatus | null | undefined;
  newStatus: ShowStatus;
  schedIds: string[];
}) {
  const queueResults: unknown[] = [];
  const uniqueSchedIds = Array.from(new Set(schedIds.filter(Boolean)));

  for (const schedId of uniqueSchedIds) {
    const showScopeId = `${showId}:${schedId}`;

    try {
      if (newStatus === "OPEN" && oldStatus !== "OPEN") {
        const result = await initializeQueueChannel(showScopeId);
        queueResults.push(result);
        continue;
      }

      if (isTransitioningToClosedStatus(oldStatus, newStatus)) {
        const result = await closeQueueChannel(
          showScopeId,
          newStatus === "CANCELLED" ? "cancelled" : "closed",
        );
        queueResults.push(result);
      }
    } catch (queueError) {
      console.error(`Queue operation failed for ${showScopeId}:`, queueError);
    }
  }

  return queueResults;
}
