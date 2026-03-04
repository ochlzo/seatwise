import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type CliOptions = {
  dryRun: boolean;
  yes: boolean;
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
    dryRun: false,
    yes: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
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
  console.log("  npm run reservations:clear-test -- --dry-run");
  console.log("  npm run reservations:clear-test -- --yes");
  console.log("");
  console.log("Options:");
  console.log("  --dry-run   Show what would be deleted/updated");
  console.log("  --yes       Required for destructive execution");
}

async function main() {
  loadDotEnvIfPresent();
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (!options.dryRun && !options.yes) {
    throw new Error("Destructive run blocked. Re-run with --yes or use --dry-run.");
  }

  const prisma = new PrismaClient();
  try {
    const targetReservations = await prisma.reservation.findMany({
      where: {
        OR: [
          { guest_id: { startsWith: TEST_GUEST_PREFIX } },
          { email: { endsWith: TEST_EMAIL_DOMAIN } },
        ],
      },
      select: { reservation_id: true },
    });

    const reservationIds = targetReservations.map((row) => row.reservation_id);

    if (reservationIds.length === 0) {
      console.log("No seeded test reservations found. Nothing to clear.");
      return;
    }

    const [paymentCount, reservedSeatRows] = await Promise.all([
      prisma.payment.count({
        where: { reservation_id: { in: reservationIds } },
      }),
      prisma.reservedSeat.findMany({
        where: { reservation_id: { in: reservationIds } },
        select: { seat_assignment_id: true },
      }),
    ]);

    const seatAssignmentIds = Array.from(new Set(reservedSeatRows.map((row) => row.seat_assignment_id)));

    console.log(`${options.dryRun ? "[dry-run] " : ""}Seeded reservation cleanup summary:`);
    console.log(`- reservations: ${reservationIds.length}`);
    console.log(`- payments: ${paymentCount}`);
    console.log(`- reserved_seats: ${reservedSeatRows.length}`);
    console.log(`- seat_assignments to reopen: ${seatAssignmentIds.length}`);

    if (options.dryRun) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({
        where: { reservation_id: { in: reservationIds } },
      });

      await tx.reservedSeat.deleteMany({
        where: { reservation_id: { in: reservationIds } },
      });

      await tx.reservation.deleteMany({
        where: { reservation_id: { in: reservationIds } },
      });

      if (seatAssignmentIds.length > 0) {
        await tx.seatAssignment.updateMany({
          where: {
            seat_assignment_id: { in: seatAssignmentIds },
            seat_status: "RESERVED",
            reservedSeats: { none: {} },
          },
          data: { seat_status: "OPEN" },
        });
      }
    });

    console.log("Done. Seeded test reservations were removed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("reservations:clear-test failed:", error);
  process.exit(1);
});

