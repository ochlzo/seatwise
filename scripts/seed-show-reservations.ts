import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type CliOptions = {
  schedId: string | null;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

const TEST_GUEST_PREFIX = "seed-show-guest-";
const TEST_EMAIL_DOMAIN = "@seatwise.test";
const DEFAULT_ADDRESS = "Seeded Reservation Address";
const DEFAULT_PHONE_PREFIX = "09";

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
    dryRun: false,
    yes: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--sched-id") {
      const next = argv[i + 1];
      if (!next) throw new Error("--sched-id requires a value");
      options.schedId = next;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--yes") {
      options.yes = true;
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
  console.log("  npm run reservations:seed-show -- --sched-id <SCHED_ID> --dry-run");
  console.log("  npm run reservations:seed-show -- --sched-id <SCHED_ID> --yes");
  console.log("");
  console.log("Options:");
  console.log("  --sched-id VALUE   Schedule ID to populate reservations for");
  console.log("  --dry-run          Show what would be created");
  console.log("  --yes              Required for destructive execution");
}

function buildReservationNumber(index: number) {
  return String(index).padStart(4, "0");
}

function buildSeedEmail(showId: string, index: number) {
  return `seed-${showId}-${index}${TEST_EMAIL_DOMAIN}`.toLowerCase();
}

function buildSeedPhone(index: number) {
  return `${DEFAULT_PHONE_PREFIX}${String(100000000 + index).padStart(9, "0")}`;
}

function formatDateTimeLabel(dateValue: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(dateValue);
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

  if (!options.dryRun && !options.yes) {
    throw new Error("Destructive run blocked. Re-run with --yes or use --dry-run.");
  }

  const prisma = new PrismaClient();
  try {
    const show = await prisma.show.findFirst({
      where: { scheds: { some: { sched_id: options.schedId } } },
      select: {
        show_id: true,
        show_name: true,
        scheds: {
          where: { sched_id: options.schedId },
          select: {
            sched_id: true,
            sched_date: true,
            sched_start_time: true,
            seatAssignments: {
              where: { seat_status: "OPEN" },
              select: {
                seat_assignment_id: true,
                seat_id: true,
                seat_status: true,
                seat: {
                  select: {
                    seat_number: true,
                  },
                },
                set: {
                  select: {
                    seatCategory: {
                      select: {
                        price: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: [{ sched_date: "asc" }, { sched_start_time: "asc" }],
        },
        reservations: {
          select: {
            reservation_number: true,
          },
        },
      },
    });

    if (!show) {
      throw new Error(`Show not found for schedule: ${options.schedId}`);
    }

    const schedule = show.scheds[0];
    if (!schedule) {
      throw new Error(`Schedule not found: ${options.schedId}`);
    }

    const openAssignments = schedule.seatAssignments.map((assignment) => ({
      sched: schedule,
      assignment,
    }));

    if (openAssignments.length === 0) {
      console.log(
        `Schedule "${schedule.sched_id}" in show "${show.show_name}" has no OPEN seat assignments.`,
      );
      return;
    }

    const targetCount = Math.max(openAssignments.length - 1, 0);
    const existingReservationNumbers = show.reservations
      .map((reservation) => Number.parseInt(reservation.reservation_number, 10))
      .filter((value) => Number.isFinite(value));
    const startingIndex =
      existingReservationNumbers.length > 0
        ? Math.max(...existingReservationNumbers) + 1
        : 1;

    console.log(`Show: ${show.show_name}`);
    console.log(`Show ID: ${show.show_id}`);
    console.log(`Sched ID: ${schedule.sched_id}`);
    console.log(`Sched date: ${formatDateTimeLabel(new Date(schedule.sched_date))}`);
    console.log(`Sched start: ${formatDateTimeLabel(new Date(schedule.sched_start_time))}`);
    console.log(`OPEN seat assignments: ${openAssignments.length}`);
    console.log(`Target reservations to create: ${targetCount}`);
    console.log(`Starting reservation number: ${buildReservationNumber(startingIndex)}`);
    console.log(`${options.dryRun ? "[dry-run] " : ""}Reservations to create: ${targetCount}`);

    if (options.dryRun) {
      for (let i = 0; i < Math.min(targetCount, 10); i += 1) {
        const { sched, assignment } = openAssignments[i];
        console.log(
          `- sched ${sched.sched_id} seat ${assignment.seat.seat_number} -> reservation ${buildReservationNumber(startingIndex + i)}`,
        );
      }
      if (targetCount > 10) {
        console.log(`- ... ${targetCount - 10} more`);
      }
      return;
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let index = 0; index < targetCount; index += 1) {
      const { sched, assignment } = openAssignments[index];
      const reservationNumber = buildReservationNumber(startingIndex + index);
      const marker = `${show.show_id}-${sched.sched_id}-${assignment.seat_assignment_id}-${index + 1}`;
      const email = buildSeedEmail(show.show_id, index + 1);
      const phone = buildSeedPhone(index + 1);

      try {
        await prisma.$transaction(async (tx) => {
          const seatUpdate = await tx.seatAssignment.updateMany({
            where: {
              seat_assignment_id: assignment.seat_assignment_id,
              seat_status: "OPEN",
            },
            data: { seat_status: "RESERVED" },
          });

          if (seatUpdate.count === 0) {
            throw new Error(
              `Seat assignment ${assignment.seat_assignment_id} is no longer OPEN`,
            );
          }

          const reservation = await tx.reservation.create({
            data: {
              reservation_number: reservationNumber,
              guest_id: `${TEST_GUEST_PREFIX}${marker}`,
              first_name: "Seeded",
              last_name: "Guest",
              address: DEFAULT_ADDRESS,
              email,
              phone_number: phone,
              show_id: show.show_id,
              sched_id: sched.sched_id,
              status: "PENDING",
            },
          });

          await tx.reservedSeat.create({
            data: {
              reservation_id: reservation.reservation_id,
              seat_assignment_id: assignment.seat_assignment_id,
            },
          });

          await tx.payment.create({
            data: {
              reservation_id: reservation.reservation_id,
              amount: assignment.set.seatCategory.price,
              method: "GCASH",
              status: "PENDING",
              paid_at: null,
              screenshot_url: null,
            },
          });
        });

        created += 1;
      } catch (error) {
        skipped += 1;
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(
          `${assignment.seat.seat_number} (${sched.sched_id}): ${message}`,
        );
      }
    }

    console.log("Show reservation seeding complete:");
    console.log(`- created: ${created}`);
    console.log(`- skipped: ${skipped}`);
    console.log("- all seeded reservations: PENDING");
    console.log(`- marker guest_id prefix: ${TEST_GUEST_PREFIX}`);
    console.log(`- marker email domain: ${TEST_EMAIL_DOMAIN}`);

    if (errors.length > 0) {
      console.log("");
      console.log("Skipped seats:");
      for (const error of errors.slice(0, 20)) {
        console.log(`- ${error}`);
      }
      if (errors.length > 20) {
        console.log(`- ... ${errors.length - 20} more`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("reservations:seed-show failed:", error);
  process.exit(1);
});
