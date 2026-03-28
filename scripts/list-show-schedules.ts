import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { PrismaClient } from "@prisma/client";

type CliOptions = {
  showId: string | null;
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
    showId: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--show-id") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--show-id requires a value");
      }
      options.showId = next;
      index += 1;
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
  console.log("  npm run shows:schedules");
  console.log("  npm run shows:schedules -- --show-id <SHOW_ID>");
  console.log("");
  console.log("Behavior:");
  console.log("  1. Lists all shows with their IDs");
  console.log("  2. Waits for a show ID when --show-id is not provided");
  console.log("  3. Prints the matching schedule labels and schedule IDs");
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(value);
}

function formatTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(value);
}

function buildScheduleLabel(schedule: {
  sched_date: Date;
  sched_start_time: Date;
  sched_end_time: Date;
}) {
  return `${formatDateLabel(schedule.sched_date)} - ${formatTimeLabel(schedule.sched_start_time)} - ${formatTimeLabel(schedule.sched_end_time)}`;
}

async function promptForShowId() {
  const rl = readline.createInterface({ input, output });

  try {
    const answer = await rl.question("Enter a show ID: ");
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function main() {
  loadDotEnvIfPresent();
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const prisma = new PrismaClient();

  try {
    const shows = await prisma.show.findMany({
      select: {
        show_id: true,
        show_name: true,
      },
      orderBy: {
        show_name: "asc",
      },
    });

    console.log("Shows:");
    if (shows.length === 0) {
      console.log("No shows found.");
      return;
    }

    for (const show of shows) {
      console.log(`- ${show.show_name} | ${show.show_id}`);
    }

    const showId = options.showId ?? (await promptForShowId());
    if (!showId) {
      throw new Error("A show ID is required.");
    }

    const show = await prisma.show.findUnique({
      where: { show_id: showId },
      select: {
        show_id: true,
        show_name: true,
        scheds: {
          select: {
            sched_id: true,
            sched_date: true,
            sched_start_time: true,
            sched_end_time: true,
          },
          orderBy: [{ sched_date: "asc" }, { sched_start_time: "asc" }],
        },
      },
    });

    if (!show) {
      throw new Error(`Show not found: ${showId}`);
    }

    console.log("");
    console.log(`Schedules for ${show.show_name} (${show.show_id}):`);

    if (show.scheds.length === 0) {
      console.log("No schedules found.");
      return;
    }

    for (const schedule of show.scheds) {
      console.log(`- ${buildScheduleLabel(schedule)} | ${schedule.sched_id}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("shows:schedules failed:", error);
  process.exit(1);
});
