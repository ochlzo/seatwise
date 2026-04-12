import "server-only";

import type { Prisma, ShowStatus } from "@prisma/client";
import { closeQueueChannel } from "@/lib/queue/closeQueue";
import { initializeQueueChannel } from "@/lib/queue/initializeQueue";
import {
  countBlockingReservations,
} from "@/lib/shows/effectiveStatus";

const isCloseLikeStatus = (status: ShowStatus) =>
  status === "CLOSED" || status === "CANCELLED";

const isQueueReservableStatus = (status: ShowStatus | null | undefined) =>
  status === "OPEN" || status === "DRY_RUN";

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
  if (nextStatus === "DRY_RUN") {
    const blockingReservationCount = await countBlockingReservations(db, showId);
    if (blockingReservationCount > 0) {
      throw new Error(
        `You cannot change this show to DRY_RUN because it already has ${blockingReservationCount} active reservations (only pending / confirmed)`,
      );
    }
  }

  if (nextStatus === "CLOSED") {
    throw new Error(
      "You cannot manually set this show to CLOSED. Closed status is managed automatically.",
    );
  }

  // Booking-based restriction only applies when leaving OPEN.
  // Transitions from CANCELLED/DRAFT/UPCOMING back to other statuses are allowed.
  const isLeavingOpen = currentStatus === "OPEN" && nextStatus !== "OPEN";
  if (!isLeavingOpen) {
    return;
  }

  const blockingReservationCount = await countBlockingReservations(db, showId);

  if (blockingReservationCount > 0) {
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
      if (isQueueReservableStatus(newStatus) && !isQueueReservableStatus(oldStatus)) {
        const result = await initializeQueueChannel(showScopeId);
        queueResults.push(result);
        continue;
      }

      if (oldStatus === "DRY_RUN" && newStatus !== "DRY_RUN") {
        const closeResult = await closeQueueChannel(showScopeId, "closed");
        queueResults.push(closeResult);

        if (newStatus === "OPEN") {
          const initResult = await initializeQueueChannel(showScopeId);
          queueResults.push(initResult);
        }
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
