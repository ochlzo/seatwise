import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type CliOptions = {
  all: boolean;
  showScopeIds: string[];
  dryRun: boolean;
  yes: boolean;
  help: boolean;
};

type CleanupSummary = {
  scopeId: string;
  redisDeletedKeys: number;
  ablyChannelsProcessed: number;
  ablyErrors: number;
};

interface RedisClient {
  keys<T = string[]>(pattern: string): Promise<T>;
  zrange<T = string[]>(key: string, start: number, stop: number): Promise<T>;
  hvals<T = string[]>(key: string): Promise<T>;
  del(...keys: string[]): Promise<number>;
}

const REDIS_BATCH_SIZE = 500;
const ABLY_REST_BASE_URL = "https://rest.ably.io";

function loadDotEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    if (!key || key in process.env) {
      continue;
    }

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
    all: false,
    showScopeIds: [],
    dryRun: false,
    yes: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") {
      options.all = true;
      continue;
    }
    if (arg === "--showScopeId") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("Missing value for --showScopeId");
      }
      options.showScopeIds.push(next);
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
  console.log("  npm run queue:cleanup -- --all --yes");
  console.log("  npm run queue:cleanup -- --showScopeId <showId:schedId> --yes");
  console.log("  npm run queue:cleanup -- --showScopeId <showId:schedId> --dry-run");
  console.log("");
  console.log("Options:");
  console.log("  --all               Clean all queue scopes discovered in Redis");
  console.log("  --showScopeId <id>  Clean a specific queue scope (repeatable)");
  console.log("  --dry-run           Preview actions without deleting");
  console.log("  --yes               Required confirmation flag for destructive runs");
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function parseScopedTicketKey(
  key: string,
  prefix: string,
): { scopeId: string; ticketId: string } | null {
  if (!key.startsWith(prefix)) {
    return null;
  }

  const suffix = key.slice(prefix.length);
  const splitIndex = suffix.lastIndexOf(":");
  if (splitIndex <= 0 || splitIndex === suffix.length - 1) {
    return null;
  }

  const scopeId = suffix.slice(0, splitIndex);
  const ticketId = suffix.slice(splitIndex + 1);
  return { scopeId, ticketId };
}

async function safeKeys(redis: RedisClient, pattern: string): Promise<string[]> {
  try {
    const result = await redis.keys<string[]>(pattern);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.warn(`Failed to list keys for pattern "${pattern}":`, error);
    return [];
  }
}

async function discoverAllScopes(redis: RedisClient): Promise<Set<string>> {
  const scopes = new Set<string>();

  const simplePrefixes: Array<{ pattern: string; prefix: string }> = [
    { pattern: "seatwise:queue:*", prefix: "seatwise:queue:" },
    { pattern: "seatwise:user_ticket:*", prefix: "seatwise:user_ticket:" },
    { pattern: "seatwise:seq:*", prefix: "seatwise:seq:" },
    { pattern: "seatwise:metrics:avg_service_ms:*", prefix: "seatwise:metrics:avg_service_ms:" },
    { pattern: "seatwise:paused:*", prefix: "seatwise:paused:" },
  ];

  for (const item of simplePrefixes) {
    const keys = await safeKeys(redis, item.pattern);
    for (const key of keys) {
      if (key.startsWith(item.prefix)) {
        scopes.add(key.slice(item.prefix.length));
      }
    }
  }

  const scopedPatterns: Array<{ pattern: string; prefix: string }> = [
    { pattern: "seatwise:ticket:*", prefix: "seatwise:ticket:" },
    { pattern: "seatwise:active:*", prefix: "seatwise:active:" },
  ];

  for (const item of scopedPatterns) {
    const keys = await safeKeys(redis, item.pattern);
    for (const key of keys) {
      const parsed = parseScopedTicketKey(key, item.prefix);
      if (parsed) {
        scopes.add(parsed.scopeId);
      }
    }
  }

  return scopes;
}

async function discoverTicketIdsForScope(redis: RedisClient, scopeId: string): Promise<Set<string>> {
  const ticketIds = new Set<string>();

  const queueKey = `seatwise:queue:${scopeId}`;
  const queueTicketIds = await redis.zrange<string[]>(queueKey, 0, -1);
  if (Array.isArray(queueTicketIds)) {
    for (const id of queueTicketIds) {
      if (id) ticketIds.add(id);
    }
  }

  const userTicketKey = `seatwise:user_ticket:${scopeId}`;
  const userMappedTickets = await redis.hvals<string[]>(userTicketKey);
  if (Array.isArray(userMappedTickets)) {
    for (const id of userMappedTickets) {
      if (id) ticketIds.add(id);
    }
  }

  const ticketKeys = await safeKeys(redis, `seatwise:ticket:${scopeId}:*`);
  for (const key of ticketKeys) {
    const parsed = parseScopedTicketKey(key, "seatwise:ticket:");
    if (parsed?.scopeId === scopeId) {
      ticketIds.add(parsed.ticketId);
    }
  }

  const activeKeys = await safeKeys(redis, `seatwise:active:${scopeId}:*`);
  for (const key of activeKeys) {
    const parsed = parseScopedTicketKey(key, "seatwise:active:");
    if (parsed?.scopeId === scopeId) {
      ticketIds.add(parsed.ticketId);
    }
  }

  return ticketIds;
}

async function deleteRedisKeys(redis: RedisClient, keys: string[], dryRun: boolean): Promise<number> {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (uniqueKeys.length === 0) {
    return 0;
  }

  if (dryRun) {
    return uniqueKeys.length;
  }

  let deleted = 0;
  for (const batch of chunk(uniqueKeys, REDIS_BATCH_SIZE)) {
    const result = await redis.del(...batch);
    if (typeof result === "number") {
      deleted += result;
    }
  }
  return deleted;
}

async function clearAblyChannelHistory(
  channelName: string,
  apiKey: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    return;
  }

  const encodedChannel = encodeURIComponent(channelName);
  const url = `${ABLY_REST_BASE_URL}/channels/${encodedChannel}/messages`;
  const authHeader = `Basic ${Buffer.from(apiKey).toString("base64")}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: authHeader,
      "X-Ably-Version": "3",
    },
  });

  if (response.ok || response.status === 404) {
    return;
  }

  const body = await response.text();
  throw new Error(
    `Ably cleanup failed for "${channelName}" (${response.status} ${response.statusText}): ${body}`,
  );
}

async function cleanupScope(
  redis: RedisClient,
  scopeId: string,
  options: Pick<CliOptions, "dryRun">,
): Promise<CleanupSummary> {
  const ticketIds = await discoverTicketIdsForScope(redis, scopeId);

  const fixedRedisKeys = [
    `seatwise:queue:${scopeId}`,
    `seatwise:seq:${scopeId}`,
    `seatwise:metrics:avg_service_ms:${scopeId}`,
    `seatwise:user_ticket:${scopeId}`,
    `seatwise:paused:${scopeId}`,
  ];

  const ticketKeys = await safeKeys(redis, `seatwise:ticket:${scopeId}:*`);
  const activeKeys = await safeKeys(redis, `seatwise:active:${scopeId}:*`);
  const redisDeletedKeys = await deleteRedisKeys(
    redis,
    [...fixedRedisKeys, ...ticketKeys, ...activeKeys],
    options.dryRun,
  );

  const channelNames = new Set<string>();
  channelNames.add(`seatwise:${scopeId}:public`);
  for (const ticketId of ticketIds) {
    channelNames.add(`seatwise:${scopeId}:private:${ticketId}`);
  }

  const ablyApiKey = process.env.ABLY_API_KEY;
  if (!ablyApiKey) {
    throw new Error("ABLY_API_KEY is not defined");
  }

  let ablyErrors = 0;
  for (const channelName of channelNames) {
    try {
      await clearAblyChannelHistory(channelName, ablyApiKey, options.dryRun);
    } catch (error) {
      ablyErrors += 1;
      console.warn(String(error));
    }
  }

  return {
    scopeId,
    redisDeletedKeys,
    ablyChannelsProcessed: channelNames.size,
    ablyErrors,
  };
}

async function main() {
  loadDotEnvIfPresent();

  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!options.all && options.showScopeIds.length === 0) {
    throw new Error("Provide --all or at least one --showScopeId");
  }

  if (!options.dryRun && !options.yes) {
    throw new Error("Destructive run blocked. Re-run with --yes or use --dry-run.");
  }

  const redisModuleUrl = pathToFileURL(
    path.resolve(process.cwd(), "lib/clients/redis.ts"),
  ).href;
  const { redis } = await import(redisModuleUrl);
  const redisClient = redis as unknown as RedisClient;

  const scopeIds = new Set<string>(options.showScopeIds);
  if (options.all) {
    const discovered = await discoverAllScopes(redisClient);
    for (const scopeId of discovered) {
      scopeIds.add(scopeId);
    }
  }

  if (scopeIds.size === 0) {
    console.log("No queue scopes found.");
    return;
  }

  console.log(
    `${options.dryRun ? "[dry-run] " : ""}Cleaning ${scopeIds.size} queue scope(s)...`,
  );

  const summaries: CleanupSummary[] = [];
  for (const scopeId of scopeIds) {
    const summary = await cleanupScope(redisClient, scopeId, options);
    summaries.push(summary);
    console.log(
      `- ${scopeId}: redis=${summary.redisDeletedKeys} key(s), ably=${summary.ablyChannelsProcessed} channel(s), ablyErrors=${summary.ablyErrors}`,
    );
  }

  const totals = summaries.reduce(
    (acc, summary) => {
      acc.redisDeletedKeys += summary.redisDeletedKeys;
      acc.ablyChannelsProcessed += summary.ablyChannelsProcessed;
      acc.ablyErrors += summary.ablyErrors;
      return acc;
    },
    { redisDeletedKeys: 0, ablyChannelsProcessed: 0, ablyErrors: 0 },
  );

  console.log("");
  console.log("Done.");
  console.log(`Redis keys ${options.dryRun ? "matched" : "deleted"}: ${totals.redisDeletedKeys}`);
  console.log(`Ably channels processed: ${totals.ablyChannelsProcessed}`);
  console.log(`Ably errors: ${totals.ablyErrors}`);
}

main().catch((error) => {
  console.error("queue:cleanup failed:", error);
  process.exit(1);
});
