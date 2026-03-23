/**
 * Local mock service-data seed script.
 *
 * Run with:
 * node --experimental-strip-types lib/queue/test-service-data.ts
 *
 * This seeds mock Redis keys that mirror the queue service-time data shape and
 * prints the expected frontend-facing values:
 * - queue rank shown in the waiting room
 * - estimated wait time
 * - stored rolling average service time
 */

{
  type TicketData = {
    ticketId: string;
    userId: string;
    sid: string;
    name: string;
    joinedAt: number;
  };

  type ActiveSession = {
    userId: string;
    ticketId: string;
    activeToken: string;
    startedAt: number;
    expiresAt: number;
  };

  type MockQueueResult = {
    waitingRank: number;
    displayRank: number;
    etaMs: number;
    estimatedWaitMinutes: number;
    avgServiceMs: number;
  };

  const DEFAULT_AVG_SERVICE_MS = 60_000;
  const showScopeId = "demo-show:demo-sched";

  class MockRedis {
    private store = new Map<string, string>();
    private sortedSets = new Map<string, Array<{ score: number; member: string }>>();

    async set(key: string, value: string | number) {
      this.store.set(key, String(value));
    }

    async get(key: string) {
      return this.store.get(key) ?? null;
    }

    async hset(key: string, values: Record<string, string>) {
      const existing = this.store.get(key);
      const parsed = existing ? (JSON.parse(existing) as Record<string, string>) : {};
      Object.assign(parsed, values);
      this.store.set(key, JSON.stringify(parsed));
    }

    async hget(key: string, field: string) {
      const raw = this.store.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed[field] ?? null;
    }

    async del(...keys: string[]) {
      for (const key of keys) {
        this.store.delete(key);
        this.sortedSets.delete(key);
      }
    }

    async zadd(key: string, entry: { score: number; member: string }) {
      const list = this.sortedSets.get(key) ?? [];
      list.push(entry);
      list.sort((a, b) => a.score - b.score);
      this.sortedSets.set(key, list);
    }

    async zrank(key: string, member: string) {
      const list = this.sortedSets.get(key) ?? [];
      const index = list.findIndex((item) => item.member === member);
      return index === -1 ? null : index;
    }

    async zcard(key: string) {
      return (this.sortedSets.get(key) ?? []).length;
    }

    snapshot() {
      return {
        strings: new Map(this.store),
        sortedSets: new Map(this.sortedSets),
      };
    }
  }

  const rollingAverage = (previousAvg: number, sampleMs: number) =>
    Math.round(previousAvg * 0.9 + sampleMs * 0.1);

  async function computeQueueResult(
    redis: MockRedis,
    scopeId: string,
    userId: string,
  ): Promise<MockQueueResult | null> {
    const userTicketKey = `seatwise:user_ticket:${scopeId}`;
    const ticketId = await redis.hget(userTicketKey, userId);
    if (!ticketId) return null;

    const ticketKey = `seatwise:ticket:${scopeId}:${ticketId}`;
    const activeKey = `seatwise:active:${scopeId}:${ticketId}`;

    const activeRaw = await redis.get(activeKey);
    const active = activeRaw ? (JSON.parse(activeRaw) as ActiveSession) : null;
    if (active && active.userId === userId && active.expiresAt > Date.now()) {
      return {
        waitingRank: 0,
        displayRank: 0,
        etaMs: 0,
        estimatedWaitMinutes: 0,
        avgServiceMs: DEFAULT_AVG_SERVICE_MS,
      };
    }

    const queueKey = `seatwise:queue:${scopeId}`;
    const rank = await redis.zrank(queueKey, ticketId);
    if (rank === null) return null;

    const avgKey = `seatwise:metrics:avg_service_ms:${scopeId}`;
    const rawAvg = await redis.get(avgKey);
    const avgServiceMs =
      typeof rawAvg === "string" && rawAvg.trim()
        ? Number.parseInt(rawAvg, 10)
        : DEFAULT_AVG_SERVICE_MS;
    const safeAvg = Number.isFinite(avgServiceMs) && avgServiceMs > 0 ? avgServiceMs : DEFAULT_AVG_SERVICE_MS;
    const waitingRank = rank + 1;
    const etaMs = waitingRank * safeAvg;

    void ticketKey;

    return {
      waitingRank,
      displayRank: waitingRank + 1,
      etaMs,
      estimatedWaitMinutes: Math.ceil(etaMs / 60000),
      avgServiceMs: safeAvg,
    };
  }

  async function main() {
    console.log("Seeding mock service_data keys...\n");

    const redis = new MockRedis();
    const queueKey = `seatwise:queue:${showScopeId}`;
    const userTicketKey = `seatwise:user_ticket:${showScopeId}`;
    const avgKey = `seatwise:metrics:avg_service_ms:${showScopeId}`;
    const seqKey = `seatwise:seq:${showScopeId}`;

    await redis.del(queueKey, userTicketKey, avgKey, seqKey);
    await redis.set(avgKey, DEFAULT_AVG_SERVICE_MS);
    await redis.set(seqKey, 7);

    const joinedAt = Date.now() - 12 * 60_000;
    const samples: Array<{ userId: string; name: string; minutesAgo: number }> = [
      { userId: "user-1", name: "Alice", minutesAgo: 12 },
      { userId: "user-2", name: "Ben", minutesAgo: 8 },
      { userId: "user-3", name: "Cara", minutesAgo: 4 },
    ];

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];
      const ticketId = `ticket-${index + 1}`;
      const ticket: TicketData = {
        ticketId,
        userId: sample.userId,
        sid: showScopeId,
        name: sample.name,
        joinedAt: joinedAt - sample.minutesAgo * 60_000,
      };

      await redis.zadd(queueKey, {
        score: ticket.joinedAt,
        member: ticketId,
      });
      await redis.hset(userTicketKey, { [sample.userId]: ticketId });
      await redis.set(`seatwise:ticket:${showScopeId}:${ticketId}`, JSON.stringify(ticket));
    }

    const activeTicketId = "ticket-active";
    const activeUserId = "user-active";
    const activeSession: ActiveSession = {
      userId: activeUserId,
      ticketId: activeTicketId,
      activeToken: "active-token",
      startedAt: Date.now() - 90_000,
      expiresAt: Date.now() + 4 * 60_000,
    };
    await redis.set(`seatwise:active:${showScopeId}:${activeTicketId}`, JSON.stringify(activeSession));
    await redis.hset(userTicketKey, { [activeUserId]: activeTicketId });
    await redis.set(
      `seatwise:ticket:${showScopeId}:${activeTicketId}`,
      JSON.stringify({
        ticketId: activeTicketId,
        userId: activeUserId,
        sid: showScopeId,
        name: "Active User",
        joinedAt: Date.now() - 90_000,
      } satisfies TicketData),
    );

    console.log(`Seeded keys for scope: ${showScopeId}`);
    console.log(`Average service key: ${avgKey}`);
    console.log(`Sequence key: ${seqKey}`);
    console.log(`Queue size: ${await redis.zcard(queueKey)}\n`);

    const avgRaw = await redis.get(avgKey);
    const avgServiceMs = typeof avgRaw === "string" ? Number.parseInt(avgRaw, 10) : DEFAULT_AVG_SERVICE_MS;

    const waitingResults = await Promise.all(
      samples.map((sample) => computeQueueResult(redis, showScopeId, sample.userId)),
    );

    console.log("Expected frontend-facing values:\n");
    waitingResults.forEach((result, index) => {
      const sample = samples[index];
      if (!result) {
        console.log(`${sample.name}: no queue result`);
        return;
      }

      console.log(`${sample.name}`);
      console.log(`  Redis waiting rank: #${result.waitingRank}`);
      console.log(`  Waiting-room display: #${result.displayRank}`);
      console.log(`  ETA: ~${result.estimatedWaitMinutes} min`);
      console.log(`  ETA ms: ${result.etaMs}`);
      console.log(`  Stored avg service time: ${result.avgServiceMs} ms`);
      console.log("");
    });

    const expectedForFrontEnd = waitingResults[0];
    if (expectedForFrontEnd) {
      console.log("Primary comparison for frontend:");
      console.log(`  expected visible position: #${expectedForFrontEnd.displayRank}`);
      console.log(`  expected ETA: ~${expectedForFrontEnd.estimatedWaitMinutes} min`);
      console.log(`  expected backend avg service time: ${avgServiceMs} ms`);
    }

    const nextAvg = rollingAverage(avgServiceMs, 90_000);
    console.log("\nExample average update if a completed room session took 90,000 ms:");
    console.log(`  previous avg: ${avgServiceMs} ms`);
    console.log(`  new avg: ${nextAvg} ms`);

    console.log("\nMock Redis snapshot retained in-memory only.");
  }

  main().catch((error) => {
    console.error("Mock service-data script failed:", error);
    process.exit(1);
  });
}
