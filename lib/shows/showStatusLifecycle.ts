import "server-only";

import type { Prisma, ShowStatus } from "@prisma/client";
import { closeQueueChannel } from "@/lib/queue/closeQueue";
import { initializeQueueChannel } from "@/lib/queue/initializeQueue";
import {
  countBlockingReservations,
  hasShowReachedFinalScheduleEnd,
} from "@/lib/shows/effectiveStatus";

const isReservationBlockingStatus = (status: ShowStatus) =>
  status === "CLOSED" ||
  status === "CANCELLED" ||
  status === "DRAFT" ||
  status === "UPCOMING";

const isCloseLikeStatus = (status: ShowStatus) =>
  status === "CLOSED" || status === "CANCELLED";

const isTransitioningToClosedStatus = (
  oldStatus: ShowStatus | null | undefined,
  newStatus: ShowStatus,
) => isCloseLikeStatus(newStatus) && (!oldStatus || !isCloseLikeStatus(oldStatus));

export async function assertShowCanMoveToRestrictedStatus(
  db: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  showId: string,
  currentStatus: ShowStatus | null | undefined,
  nextStatus: ShowStatus,
) {
  if (!isReservationBlockingStatus(nextStatus)) {
    return;
  }

  if (nextStatus === "CLOSED") {
    const hasReachedFinalScheduleEnd = await hasShowReachedFinalScheduleEnd(db, showId);
    if (!hasReachedFinalScheduleEnd) {
      throw new Error("You cannot change this OPEN production to CLOSED before the show even starts.");
    }
    return;
  }

  const blockingReservationCount = await countBlockingReservations(db, showId);

  if (blockingReservationCount > 0) {
    if (currentStatus === "OPEN") {
      if (nextStatus === "DRAFT") {
        throw new Error(
          `You cannot change this OPEN production back to DRAFT because it already has ${blockingReservationCount} active reservations (only pending / confirmed)`,
        );
      }
      if (nextStatus === "UPCOMING") {
        throw new Error(
          `You cannot change this OPEN production back to UPCOMING because it already has ${blockingReservationCount} active reservations (only pending / confirmed)`,
        );
      }
      if (nextStatus === "CANCELLED") {
        throw new Error(
          `You cannot change this OPEN production to CANCELLED because it already has ${blockingReservationCount} active reservations (only pending / confirmed)`,
        );
      }
    }
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
