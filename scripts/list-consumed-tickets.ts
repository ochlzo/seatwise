import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type CliOptions = {
  schedId: string | null;
  json: boolean;
  help: boolean;
};

function loadDotEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    if (!key || key in process.env) continue;

    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    schedId: null,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--sched-id") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--sched-id requires a value");
      }
      options.schedId = next;
      index += 1;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log("Usage:");
  console.log("  npm run tickets:consumed -- --sched-id <SCHED_ID>");
  console.log("  npm run tickets:consumed -- --sched-id <SCHED_ID> --json");
  console.log("");
  console.log("Options:");
  console.log("  --sched-id VALUE   Schedule ID to inspect");
  console.log("  --json             Print the results as JSON");
  console.log("  --help, -h         Show this help message");
}

function formatDateTime(value: Date | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}

async function main() {
  loadDotEnvIfPresent();
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (!options.schedId) {
    throw new Error("Missing required --sched-id <SCHED_ID> argument.");
  }

  const prisma = new PrismaClient();

  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        sched_id: options.schedId,
        ticket_consumed_at: { not: null },
      },
      select: {
        reservation_id: true,
        reservation_number: true,
        first_name: true,
        last_name: true,
        email: true,
        status: true,
        ticket_issued_at: true,
        ticket_consumed_at: true,
        show: {
          select: {
            show_id: true,
            show_name: true,
            venue: true,
          },
        },
        sched: {
          select: {
            sched_id: true,
            sched_date: true,
            sched_start_time: true,
          },
        },
        ticketConsumedByAdmin: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        reservedSeats: {
          select: {
            seatAssignment: {
              select: {
                seat_id: true,
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
      orderBy: [{ ticket_consumed_at: "desc" }, { reservation_number: "asc" }],
    });

    const formatted = reservations.map((reservation) => ({
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      customerName: `${reservation.first_name} ${reservation.last_name}`.trim(),
      email: reservation.email,
      status: reservation.status,
      showId: reservation.show.show_id,
      showName: reservation.show.show_name,
      venue: reservation.show.venue,
      schedId: reservation.sched.sched_id,
      scheduleDate: formatDateTime(reservation.sched.sched_date),
      scheduleStart: formatDateTime(reservation.sched.sched_start_time),
      ticketIssuedAt: formatDateTime(reservation.ticket_issued_at),
      ticketConsumedAt: formatDateTime(reservation.ticket_consumed_at),
      consumedBy:
        reservation.ticketConsumedByAdmin
          ? {
              userId: reservation.ticketConsumedByAdmin.user_id,
              name: `${reservation.ticketConsumedByAdmin.first_name} ${reservation.ticketConsumedByAdmin.last_name}`.trim(),
              email: reservation.ticketConsumedByAdmin.email,
            }
          : null,
      seats: reservation.reservedSeats.map(({ seatAssignment }) => ({
        seatId: seatAssignment.seat_id,
        seatNumber: seatAssignment.seat.seat_number,
        seatStatus: seatAssignment.seat_status,
      })),
    }));

    if (options.json) {
      console.log(JSON.stringify(formatted, null, 2));
      return;
    }

    console.log(`Consumed tickets for sched ${options.schedId}: ${formatted.length}`);

    if (formatted.length === 0) {
      console.log("No consumed tickets found.");
      return;
    }

    for (const ticket of formatted) {
      const seatLabel = ticket.seats
        .map((seat) => `${seat.seatNumber} (${seat.seatStatus})`)
        .join(", ");
      const consumedBy = ticket.consumedBy
        ? `${ticket.consumedBy.name} <${ticket.consumedBy.email}>`
        : "Unknown admin";

      console.log("");
      console.log(`Reservation: ${ticket.reservationNumber}`);
      console.log(`Customer: ${ticket.customerName} <${ticket.email}>`);
      console.log(`Show: ${ticket.showName}`);
      console.log(`Venue: ${ticket.venue}`);
      console.log(`Schedule: ${ticket.scheduleDate} | ${ticket.scheduleStart}`);
      console.log(`Issued: ${ticket.ticketIssuedAt ?? "Not issued"}`);
      console.log(`Consumed: ${ticket.ticketConsumedAt ?? "Not consumed"}`);
      console.log(`Consumed By: ${consumedBy}`);
      console.log(`Seats: ${seatLabel || "None"}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("tickets:consumed failed:", error);
  process.exit(1);
});
