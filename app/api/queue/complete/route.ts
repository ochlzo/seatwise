import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import cloudinary from "@/lib/cloudinary";
import { sendReservationSubmittedEmail } from "@/lib/email/sendReservationSubmittedEmail";
import { sendWalkInReceiptEmail } from "@/lib/email/sendWalkInReceiptEmail";
import { prisma } from "@/lib/prisma";
import { completeActiveSessionAndPromoteNext } from "@/lib/queue/queueLifecycle";
import { validateActiveSession } from "@/lib/queue/validateActiveSession";
import { buildCompletionPaymentRecord } from "@/lib/reservations/completionPayment";
import {
  getEffectiveSchedStatus,
  isSchedStatusReservable,
  syncScheduleCapacityStatuses,
} from "@/lib/shows/effectiveStatus";
import {
  type WalkInReceiptPayload,
} from "@/lib/walk-in/receipt";
import { uploadWalkInReceiptImage } from "@/lib/walk-in/uploadReceiptImage";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const formatScheduleLabel = (dateValue: Date, startValue: Date, endValue: Date) => {
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateValue);
  const timeLabel = new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dateLabel}, ${timeLabel.format(startValue)} - ${timeLabel.format(endValue)}`;
};

const normalize = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PH_PHONE_REGEX = /^09\d{9}$/;
const DATA_URL_IMAGE_REGEX = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
const RESERVATION_NUMBER_MAX_ATTEMPTS = 50;
const RESERVATION_TRANSACTION_TIMEOUT_MS = 15_000;

type CompletionMode = "online" | "walk_in";

type CompletionRequestBody = {
  showId?: string;
  schedId?: string;
  guestId?: string;
  ticketId?: string;
  activeToken?: string;
  seatIds?: string[];
  screenshotUrl?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  email?: string;
  phoneNumber?: string;
  mode?: CompletionMode;
};

type ReservationDraft = {
  reservationId: string;
  reservationNumber: string;
  seatNumbers: string[];
  totalAmount: number;
};

const generateReservationNumber = () =>
  Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0");

const normalizeMode = (value: unknown): CompletionMode =>
  value === "walk_in" ? "walk_in" : "online";

const buildContact = (body: CompletionRequestBody) => ({
  firstName: normalize(body.firstName),
  lastName: normalize(body.lastName),
  address: normalize(body.address),
  email: normalize(body.email).toLowerCase(),
  phoneNumber: normalize(body.phoneNumber),
});

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CompletionRequestBody;
    const mode = normalizeMode(body.mode);
    const isWalkInMode = mode === "walk_in";
    let adminContext: Awaited<ReturnType<typeof getCurrentAdminContext>> | null = null;

    const showId = normalize(body.showId);
    const schedId = normalize(body.schedId);
    const ticketId = normalize(body.ticketId);
    const activeToken = normalize(body.activeToken);

    let participantId = normalize(body.guestId);

    if (isWalkInMode) {
      try {
        adminContext = await getCurrentAdminContext();
        participantId = adminContext.userId;
      } catch (error) {
        if (error instanceof AdminContextError) {
          return NextResponse.json({ success: false, error: error.message }, { status: error.status });
        }

        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!showId || !schedId || !participantId || !ticketId || !activeToken) {
      return NextResponse.json(
        { success: false, error: "Missing queue session identifiers." },
        { status: 400 },
      );
    }

    const seatIds = Array.isArray(body.seatIds) ? body.seatIds : [];
    if (seatIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please select at least one seat." },
        { status: 400 },
      );
    }

    if (!isWalkInMode) {
      if (!body.screenshotUrl || !DATA_URL_IMAGE_REGEX.test(body.screenshotUrl)) {
        return NextResponse.json(
          { success: false, error: "Invalid payment screenshot payload." },
          { status: 400 },
        );
      }
    }

    const contact = buildContact(body);
    if (
      !contact.firstName ||
      !contact.lastName ||
      !contact.address ||
      !contact.email ||
      !contact.phoneNumber
    ) {
      return NextResponse.json(
        { success: false, error: "Complete contact details are required." },
        { status: 400 },
      );
    }

    if (!EMAIL_REGEX.test(contact.email)) {
      return NextResponse.json({ success: false, error: "Invalid email address." }, { status: 400 });
    }

    if (!PH_PHONE_REGEX.test(contact.phoneNumber)) {
      return NextResponse.json(
        { success: false, error: "Phone number must start with 09 and be 11 digits." },
        { status: 400 },
      );
    }

    const schedule = await prisma.sched.findFirst({
      where: {
        sched_id: schedId,
        show_id: showId,
        show:
          isWalkInMode && adminContext && !adminContext.isSuperadmin
            ? { team_id: adminContext.teamId ?? "__NO_TEAM__" }
            : undefined,
      },
      select: {
        sched_id: true,
        sched_date: true,
        sched_start_time: true,
        sched_end_time: true,
        status: true,
        show: {
          select: {
            show_name: true,
            venue: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ success: false, error: "Schedule not found" }, { status: 404 });
    }

    if (!isSchedStatusReservable(getEffectiveSchedStatus(schedule))) {
      return NextResponse.json(
        { success: false, error: "This schedule is not currently accepting reservations." },
        { status: 400 },
      );
    }

    const showScopeId = `${showId}:${schedId}`;
    const validation = await validateActiveSession({
      showScopeId,
      ticketId,
      userId: participantId,
      activeToken,
    });

    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { success: false, error: "Active session is invalid or expired", reason: validation.reason },
        { status: 400 },
      );
    }

    const assignments = await prisma.seatAssignment.findMany({
      where: {
        sched_id: schedId,
        seat_id: { in: seatIds },
      },
      include: {
        seat: { select: { seat_number: true } },
        set: {
          select: {
            seatCategory: { select: { price: true } },
          },
        },
      },
    });

    if (assignments.length !== seatIds.length) {
      return NextResponse.json(
        { success: false, error: "Some selected seats are unavailable." },
        { status: 400 },
      );
    }

    const seatAssignmentIds = assignments.map((item) => item.seat_assignment_id);
    const seatNumbers = assignments.map((item) => item.seat.seat_number);
    const totalAmount = assignments.reduce(
      (sum, item) => sum + Number(item.set.seatCategory.price),
      0,
    );

    let uploadedScreenshotUrl: string | null = null;
    if (!isWalkInMode) {
      try {
        const upload = await cloudinary.uploader.upload(body.screenshotUrl!, {
          folder: "seatwise/settings/payment_submissions",
          resource_type: "image",
        });
        uploadedScreenshotUrl = upload.secure_url;
      } catch (error) {
        console.error("[queue/complete] failed to upload payment screenshot:", error);
        return NextResponse.json(
          { success: false, error: "Failed to upload payment screenshot." },
          { status: 500 },
        );
      }
    }

    const scheduleLabel = formatScheduleLabel(
      schedule.sched_date,
      schedule.sched_start_time,
      schedule.sched_end_time,
    );

    let reservation: ReservationDraft | null = null;
    let walkInReceiptPayload: WalkInReceiptPayload | null = null;
    let walkInReceiptUrl: string | null = null;
    let paymentRecordedAt: Date | null = null;

    for (let attempt = 1; attempt <= RESERVATION_NUMBER_MAX_ATTEMPTS; attempt += 1) {
      const reservationNumber = generateReservationNumber();

      if (isWalkInMode) {
        walkInReceiptPayload = {
          reservationNumber,
          customerName: `${contact.firstName} ${contact.lastName}`.trim(),
          customerEmail: contact.email,
          customerPhoneNumber: contact.phoneNumber,
          showName: schedule.show.show_name,
          venue: schedule.show.venue,
          scheduleLabel,
          seatNumbers,
          totalAmount,
        };

        try {
          walkInReceiptUrl = await uploadWalkInReceiptImage(walkInReceiptPayload, {
            folder: "seatwise/settings/walk_in_receipts",
            publicIdPrefix: "walk-in",
            format: "png",
          });
        } catch (error) {
          console.error("[queue/complete] failed to upload walk-in receipt:", error);
          return NextResponse.json(
            { success: false, error: "Failed to generate walk-in receipt." },
            { status: 500 },
          );
        }
      }

      try {
        paymentRecordedAt = isWalkInMode ? new Date() : null;
        const paymentRecord = buildCompletionPaymentRecord({
          mode,
          assetUrl: isWalkInMode ? walkInReceiptUrl : uploadedScreenshotUrl,
          paidAt: paymentRecordedAt,
        });

        reservation = await prisma.$transaction(async (tx) => {
          const reservedSeats = await tx.seatAssignment.updateMany({
            where: {
              seat_assignment_id: { in: seatAssignmentIds },
              seat_status: "OPEN",
            },
            data: { seat_status: "RESERVED" },
          });

          if (reservedSeats.count !== seatAssignmentIds.length) {
            throw new Error("One or more selected seats are already reserved.");
          }

          const created = (await tx.reservation.create({
            data: {
              reservation_number: reservationNumber,
              guest_id: participantId,
              show_id: showId,
              sched_id: schedId,
              first_name: contact.firstName,
              last_name: contact.lastName,
              address: contact.address,
              email: contact.email,
              phone_number: contact.phoneNumber,
              status: isWalkInMode ? "CONFIRMED" : "PENDING",
            },
          })) as { reservation_id: string; reservation_number: string };

          await tx.reservedSeat.createMany({
            data: seatAssignmentIds.map((seatAssignmentId) => ({
              reservation_id: created.reservation_id,
              seat_assignment_id: seatAssignmentId,
            })),
          });

          await tx.payment.create({
            data: {
              reservation_id: created.reservation_id,
              amount: totalAmount,
              ...paymentRecord,
            },
          });

          await syncScheduleCapacityStatuses(tx, [schedId]);

          return {
            reservationId: created.reservation_id,
            reservationNumber: created.reservation_number,
            seatNumbers,
            totalAmount,
          };
        }, { timeout: RESERVATION_TRANSACTION_TIMEOUT_MS });

        break;
      } catch (error) {
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002";

        const conflictTargets = isUniqueConflict
          ? Array.isArray(error.meta?.target)
            ? error.meta.target.map(String)
            : []
          : [];

        const isReservationNumberConflict =
          isUniqueConflict &&
          (conflictTargets.includes("Reservation_show_id_reservation_number_key") ||
            (conflictTargets.includes("show_id") && conflictTargets.includes("reservation_number")));

        if (isReservationNumberConflict) {
          continue;
        }

        throw error;
      }
    }

    if (!reservation) {
      throw new Error("Failed to generate a unique reservation number. Please try again.");
    }

    const promotion = await completeActiveSessionAndPromoteNext({
      showScopeId,
      session: validation.session,
    });

    let warning: string | null = null;

    if (isWalkInMode && walkInReceiptPayload) {
      try {
        await sendWalkInReceiptEmail({
          to: contact.email,
          customerName: walkInReceiptPayload.customerName,
          reservationNumber: reservation.reservationNumber,
          showName: schedule.show.show_name,
          scheduleLabel,
          seatNumbers: reservation.seatNumbers,
          totalAmount: formatCurrency(reservation.totalAmount),
          receiptImageUrl: walkInReceiptUrl ?? "",
        });
      } catch (error) {
        console.error("[queue/complete] failed to send walk-in receipt email:", error);
        warning = "Walk-in sale was saved, but the receipt email could not be sent.";
      }
    }

    if (!isWalkInMode) {
      void sendReservationSubmittedEmail({
        to: contact.email,
        customerName: `${contact.firstName} ${contact.lastName}`.trim(),
        reservationNumber: reservation.reservationNumber,
        showName: schedule.show.show_name,
        scheduleLabel: new Date(schedule.sched_date).toLocaleDateString(),
        seatNumbers: reservation.seatNumbers,
        totalAmount: formatCurrency(reservation.totalAmount),
        proofImageUrl: uploadedScreenshotUrl,
      }).catch((error) => {
        console.error("[queue/complete] failed to send email:", error);
      });
    }

    return NextResponse.json({
      success: true,
      reservationId: reservation.reservationId,
      reservationNumber: reservation.reservationNumber,
      showScopeId,
      showName: schedule.show.show_name,
      reservedCount: reservation.seatNumbers.length,
      emailSent: isWalkInMode ? warning == null : true,
      warning,
      promoted: promotion.promoted,
      next: promotion.activeSession
        ? {
            ticketId: promotion.activeSession.ticketId,
            activeToken: promotion.activeSession.activeToken,
            expiresAt: promotion.activeSession.expiresAt,
          }
        : null,
    });
  } catch (error) {
    console.error("[queue/complete] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
