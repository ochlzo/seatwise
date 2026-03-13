import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type CliOptions = {
  dryRun: boolean;
  yes: boolean;
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
  console.log("  npm run bookings:clear -- --dry-run");
  console.log("  npm run bookings:clear -- --yes");
  console.log("");
  console.log("Tables/models affected:");
  console.log("  reservation, reservedseat, categoryset, categorysetitem, payment,");
  console.log("  sched, seatassignment, seatcategory, set, show");
  console.log("");
  console.log("Options:");
  console.log("  --dry-run   Show what would be deleted");
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
    const [
      reservationCount,
      reservedSeatCount,
      categorySetCount,
      categorySetItemCount,
      paymentCount,
      schedCount,
      seatAssignmentCount,
      seatCategoryCount,
      setCount,
      showCount,
    ] = await Promise.all([
      prisma.reservation.count(),
      prisma.reservedSeat.count(),
      prisma.categorySet.count(),
      prisma.categorySetItem.count(),
      prisma.payment.count(),
      prisma.sched.count(),
      prisma.seatAssignment.count(),
      prisma.seatCategory.count(),
      prisma.set.count(),
      prisma.show.count(),
    ]);

    console.log(`${options.dryRun ? "[dry-run] " : ""}Booking domain cleanup summary:`);
    console.log(`- reservation: ${reservationCount}`);
    console.log(`- reservedseat (reserved_seats): ${reservedSeatCount}`);
    console.log(`- categoryset: ${categorySetCount}`);
    console.log(`- categorysetitem: ${categorySetItemCount}`);
    console.log(`- payment: ${paymentCount}`);
    console.log(`- sched: ${schedCount}`);
    console.log(`- seatassignment: ${seatAssignmentCount}`);
    console.log(`- seatcategory: ${seatCategoryCount}`);
    console.log(`- set: ${setCount}`);
    console.log(`- show: ${showCount}`);

    if (options.dryRun) return;

    await prisma.$transaction(async (tx) => {
      // FK-safe delete order for the requested domain.
      await tx.payment.deleteMany({});
      await tx.reservedSeat.deleteMany({});
      await tx.reservation.deleteMany({});
      await tx.seatAssignment.deleteMany({});
      await tx.set.deleteMany({});
      await tx.sched.deleteMany({});
      await tx.categorySetItem.deleteMany({});
      await tx.categorySet.deleteMany({});
      await tx.seatCategory.deleteMany({});
      await tx.show.deleteMany({});
    });

    console.log("");
    console.log("Done. Requested booking-domain tables were cleared.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("bookings:clear failed:", error);
  process.exit(1);
});

