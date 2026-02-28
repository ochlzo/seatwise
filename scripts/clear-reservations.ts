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
  console.log("  npm run reservations:clear -- --dry-run");
  console.log("  npm run reservations:clear -- --yes");
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
    const [reservationCount, paymentCount, reservedSeatCount, reservedAssignmentsCount] =
      await Promise.all([
        prisma.reservation.count(),
        prisma.payment.count(),
        prisma.reservedSeat.count(),
        prisma.seatAssignment.count({ where: { seat_status: "RESERVED" } }),
      ]);

    console.log(`${options.dryRun ? "[dry-run] " : ""}Reservation cleanup summary:`);
    console.log(`- reservations: ${reservationCount}`);
    console.log(`- payments: ${paymentCount}`);
    console.log(`- reserved_seats: ${reservedSeatCount}`);
    console.log(`- seat_assignments RESERVED -> OPEN: ${reservedAssignmentsCount}`);

    if (options.dryRun) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({});
      await tx.reservedSeat.deleteMany({});
      await tx.reservation.deleteMany({});
      await tx.seatAssignment.updateMany({
        where: { seat_status: "RESERVED" },
        data: { seat_status: "OPEN" },
      });
    });

    console.log("");
    console.log("Done. All reservations were cleared and reserved seats were reopened.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("reservations:clear failed:", error);
  process.exit(1);
});

