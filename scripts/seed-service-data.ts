import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type RedisClient = {
  set(key: string, value: string | number): Promise<unknown>;
  get<T = string | number | null>(key: string): Promise<T>;
  zadd(key: string, entry: { score: number; member: string }): Promise<unknown>;
  hset(key: string, values: Record<string, string>): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  zcard<T = number>(key: string): Promise<T>;
  zrank<T = number | null>(key: string, member: string): Promise<T>;
};

type SeededUser = {
  userId: string;
  name: string;
  queueMinutesAgo: number;
};

const DEFAULT_AVG_SERVICE_MS = 60_000;
const DEFAULT_SCOPE_ID = "demo-show:demo-sched";

function loadDotEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

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

const rollingAverage = (previousAvg: number, sampleMs: number) =>
  Math.round(previousAvg * 0.9 + sampleMs * 0.1);

async function main() {
  loadDotEnvIfPresent();

  const scopeId = process.argv[2] || DEFAULT_SCOPE_ID;
  const redisModuleUrl = pathToFileURL(path.resolve(process.cwd(), "lib/clients/redis.ts")).href;
  const { redis } = (await import(redisModuleUrl)) as { redis: RedisClient };

  const queueKey = `seatwise:queue:${scopeId}`;
  const userTicketKey = `seatwise:user_ticket:${scopeId}`;
  const avgKey = `seatwise:metrics:avg_service_ms:${scopeId}`;
  const seqKey = `seatwise:seq:${scopeId}`;

  const users: SeededUser[] = [
    { userId: "demo-user-1", name: "Alice Demo", queueMinutesAgo: 12 },
    { userId: "demo-user-2", name: "Ben Demo", queueMinutesAgo: 8 },
    { userId: "demo-user-3", name: "Cara Demo", queueMinutesAgo: 4 },
  ];

  const activeTicketId = "demo-active-ticket";
  const activeUserId = "demo-user-active";

  const keysToDelete = [
    queueKey,
    userTicketKey,
    avgKey,
    seqKey,
    `seatwise:active:${scopeId}:${activeTicketId}`,
    `seatwise:ticket:${scopeId}:${activeTicketId}`,
    ...users.flatMap((user) => [
      `seatwise:ticket:${scopeId}:${user.userId}`,
      `seatwise:active:${scopeId}:${user.userId}`,
    ]),
  ];

  await redis.del(...keysToDelete);

  await redis.set(avgKey, DEFAULT_AVG_SERVICE_MS);
  await redis.set(seqKey, 1);

  const baseJoinedAt = Date.now() - 15 * 60_000;
  for (const [index, user] of users.entries()) {
    const ticketId = `demo-ticket-${index + 1}`;
    const joinedAt = baseJoinedAt + index * 240_000;

    await redis.zadd(queueKey, { score: joinedAt, member: ticketId });
    await redis.hset(userTicketKey, { [user.userId]: ticketId });
    await redis.set(
      `seatwise:ticket:${scopeId}:${ticketId}`,
      JSON.stringify({
        ticketId,
        userId: user.userId,
        sid: scopeId,
        name: user.name,
        joinedAt,
      }),
    );
  }

  const activeStartedAt = Date.now() - 90_000;
  await redis.set(
    `seatwise:active:${scopeId}:${activeTicketId}`,
    JSON.stringify({
      userId: activeUserId,
      ticketId: activeTicketId,
      activeToken: "demo-active-token",
      startedAt: activeStartedAt,
      expiresAt: Date.now() + 4 * 60_000,
    }),
  );
  await redis.hset(userTicketKey, { [activeUserId]: activeTicketId });
  await redis.set(
    `seatwise:ticket:${scopeId}:${activeTicketId}`,
    JSON.stringify({
      ticketId: activeTicketId,
      userId: activeUserId,
      sid: scopeId,
      name: "Active Demo",
      joinedAt: activeStartedAt,
    }),
  );

  const avgServiceMsRaw = (await redis.get(avgKey)) as string | number | null;
  const avgServiceMs =
    typeof avgServiceMsRaw === "number"
      ? avgServiceMsRaw
      : typeof avgServiceMsRaw === "string"
        ? Number.parseInt(avgServiceMsRaw, 10)
        : DEFAULT_AVG_SERVICE_MS;

  console.log(`Seeded live Redis demo scope: ${scopeId}`);
  console.log(`Queue key: ${queueKey}`);
  console.log(`Average service time key: ${avgKey}`);
  console.log(`Stored average service time: ${avgServiceMs} ms`);
  console.log(`Queue size: ${await redis.zcard(queueKey)}`);
  console.log("");

  const waitingUser = users[0];
  const waitingTicketId = "demo-ticket-1";
  const waitingRankRaw = await redis.zrank(queueKey, waitingTicketId);
  const waitingRank =
    typeof waitingRankRaw === "number" && Number.isFinite(waitingRankRaw)
      ? waitingRankRaw + 1
      : 0;
  const waitingDisplayRank = waitingRank + 1;
  const waitingEtaMs = waitingRank * avgServiceMs;

  console.log("Expected frontend comparison:");
  console.log(`  user: ${waitingUser.name}`);
  console.log(`  waiting-room display: #${waitingDisplayRank}`);
  console.log(`  ETA: ~${Math.ceil(waitingEtaMs / 60000)} min`);
  console.log(`  raw waiting rank: #${waitingRank}`);

  const nextAvg = rollingAverage(avgServiceMs, 90_000);
  console.log("");
  console.log("Expected rolling-average update example:");
  console.log(`  previous avg: ${avgServiceMs} ms`);
  console.log(`  sample service time: 90000 ms`);
  console.log(`  next avg: ${nextAvg} ms`);
}

main().catch((error) => {
  console.error("seed-service-data failed:", error);
  process.exit(1);
});
