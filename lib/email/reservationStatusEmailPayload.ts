type ReservationStatusTarget = "CONFIRMED" | "CANCELLED";

type ReservationStatusEmailLineItem = {
  reservationNumber: string;
  showName: string;
  scheduleLabel: string;
  seatNumbers: string[];
  amount: string;
};

type ReservationStatusEmailGroup = {
  to: string;
  customerName: string;
  lineItems: ReservationStatusEmailLineItem[];
};

type ReservationLike = {
  email: string;
  first_name: string;
  last_name: string;
  reservation_number: string;
  show: {
    show_name: string;
  };
  sched: {
    sched_date: Date;
    sched_start_time: Date;
    sched_end_time: Date;
  };
  payment?: {
    amount?: number | string | null;
  } | null;
  reservedSeats: Array<{
    seatAssignment: {
      seat: {
        seat_number: string;
      };
    };
  }>;
};

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

export const buildReservationStatusEmailGroups = (
  reservations: ReservationLike[],
): ReservationStatusEmailGroup[] => {
  const emailGroups = new Map<string, ReservationStatusEmailGroup>();

  for (const reservation of reservations) {
    const key = reservation.email.trim().toLowerCase();
    const existing = emailGroups.get(key);
    const lineItem: ReservationStatusEmailLineItem = {
      reservationNumber: reservation.reservation_number,
      showName: reservation.show.show_name,
      scheduleLabel: formatScheduleLabel(
        reservation.sched.sched_date,
        reservation.sched.sched_start_time,
        reservation.sched.sched_end_time,
      ),
      seatNumbers: reservation.reservedSeats.map(
        (row) => row.seatAssignment.seat.seat_number,
      ),
      amount: formatCurrency(Number(reservation.payment?.amount ?? 0)),
    };

    if (!existing) {
      emailGroups.set(key, {
        to: reservation.email,
        customerName: `${reservation.first_name} ${reservation.last_name}`.trim(),
        lineItems: [lineItem],
      });
      continue;
    }

    existing.lineItems.push(lineItem);
  }

  return Array.from(emailGroups.values());
};

export type {
  ReservationLike,
  ReservationStatusEmailGroup,
  ReservationStatusEmailLineItem,
  ReservationStatusTarget,
};
