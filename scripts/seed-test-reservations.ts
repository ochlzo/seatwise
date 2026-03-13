import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type CliOptions = {
  count: number;
  help: boolean;
};

const TEST_GUEST_PREFIX = "seed-test-guest-";
const TEST_EMAIL_DOMAIN = "@seatwise.test";

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
    count: 20,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--count") {
      const next = argv[i + 1];
      if (!next) throw new Error("--count requires a numeric value");
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--count must be a positive integer");
      }
      options.count = parsed;
      i += 1;
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
  console.log("  npm run reservations:seed-test");
  console.log("  npm run reservations:seed-test -- --count 30");
  console.log("");
  console.log("Options:");
  console.log("  --count N   Number of test reservations to create (default: 20, split across 2 shows)");
}

const firstNames = [
  "Alex",
  "Sam",
  "Jordan",
  "Taylor",
  "Jamie",
  "Morgan",
  "Avery",
  "Riley",
  "Casey",
  "Cameron",
];

const lastNames = [
  "Reyes",
  "Santos",
  "Garcia",
  "Torres",
  "Cruz",
  "Mendoza",
  "Navarro",
  "Ramos",
  "Flores",
  "Castro",
];

function pickName(index: number) {
  return {
    firstName: firstNames[index % firstNames.length],
    lastName: lastNames[index % lastNames.length],
  };
}

async function main() {
  loadDotEnvIfPresent();
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const prisma = new PrismaClient();
  const runKey = Date.now().toString();

  try {
    const allOpenAssignments = await prisma.seatAssignment.findMany({
      where: { seat_status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: {
        seat: {
          select: { seat_number: true },
        },
        sched: {
          select: {
            sched_id: true,
            show_id: true,
            show: { select: { show_name: true } },
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
    });

    if (allOpenAssignments.length === 0) {
      console.log("No OPEN seat assignments available. Nothing seeded.");
      return;
    }

    const assignmentsByShow = new Map<string, typeof allOpenAssignments>();
    for (const assignment of allOpenAssignments) {
      const showId = assignment.sched.show_id;
      const bucket = assignmentsByShow.get(showId) ?? [];
      bucket.push(assignment);
      assignmentsByShow.set(showId, bucket);
    }

    const selectedShows = Array.from(assignmentsByShow.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 2);

    if (selectedShows.length < 2) {
      console.log("Need at least 2 shows with OPEN seat assignments to seed distributed test records.");
      return;
    }

    const [showAId, showAAssignments] = selectedShows[0];
    const [showBId, showBAssignments] = selectedShows[1];
    const availableTotal = showAAssignments.length + showBAssignments.length;
    const targetCount = Math.min(options.count, availableTotal);

    if (targetCount < options.count) {
      console.log(`Only ${targetCount} seats available across 2 shows (requested ${options.count}).`);
    }

    const assignments: typeof allOpenAssignments = [];
    let idxA = 0;
    let idxB = 0;
    while (assignments.length < targetCount) {
      if (idxA < showAAssignments.length) {
        assignments.push(showAAssignments[idxA]);
        idxA += 1;
      }
      if (assignments.length >= targetCount) break;
      if (idxB < showBAssignments.length) {
        assignments.push(showBAssignments[idxB]);
        idxB += 1;
      }
      if (idxA >= showAAssignments.length && idxB >= showBAssignments.length) break;
    }

    let created = 0;
    let skipped = 0;
    const createdByShow = new Map<string, number>([
      [showAId, 0],
      [showBId, 0],
    ]);
    const reservationNumberByShow = new Map<string, number>([
      [showAId, 0],
      [showBId, 0],
    ]);

    for (let i = 0; i < assignments.length; i += 1) {
      const assignment = assignments[i];
      const marker = `${runKey}-${i + 1}`;
      const { firstName, lastName } = pickName(i);
      const email = `seed-${marker}${TEST_EMAIL_DOMAIN}`;
      const phone = `09${String(100000000 + i).padStart(9, "0")}`;
      const nextReservationNumber = (
        reservationNumberByShow.get(assignment.sched.show_id) ?? 0
      ).toString().padStart(4, "0");

      try {
        await prisma.$transaction(async (tx) => {
          const reserveSeat = await tx.seatAssignment.updateMany({
            where: {
              seat_assignment_id: assignment.seat_assignment_id,
              seat_status: "OPEN",
            },
            data: { seat_status: "RESERVED" },
          });

          if (reserveSeat.count === 0) {
            throw new Error("Seat was no longer OPEN");
          }

          const reservation = await tx.reservation.create({
            data: {
              guest_id: `${TEST_GUEST_PREFIX}${marker}`,
              first_name: firstName,
              last_name: lastName,
              address: "Seed Test Address",
              email,
              phone_number: phone,
              show_id: assignment.sched.show_id,
              sched_id: assignment.sched.sched_id,
              reservation_number: nextReservationNumber,
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
        createdByShow.set(
          assignment.sched.show_id,
          (createdByShow.get(assignment.sched.show_id) ?? 0) + 1,
        );
        reservationNumberByShow.set(
          assignment.sched.show_id,
          (reservationNumberByShow.get(assignment.sched.show_id) ?? 0) + 1,
        );
      } catch {
        skipped += 1;
      }
    }

    console.log("Test reservation seeding complete:");
    console.log(`- created: ${created}`);
    console.log(`- skipped: ${skipped}`);
    console.log(`- show A (${showAAssignments[0]?.sched.show.show_name ?? showAId}): ${createdByShow.get(showAId) ?? 0}`);
    console.log(`- show B (${showBAssignments[0]?.sched.show.show_name ?? showBId}): ${createdByShow.get(showBId) ?? 0}`);
    console.log("- all seeded reservations: PENDING");
    console.log(`- marker email domain: ${TEST_EMAIL_DOMAIN}`);
    console.log(`- marker guest_id prefix: ${TEST_GUEST_PREFIX}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("reservations:seed-test failed:", error);
  process.exit(1);
});
