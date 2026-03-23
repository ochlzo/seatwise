/**
 * Queue average service time local mock test.
 *
 * Run with:
 * node --experimental-strip-types lib/queue/test-average-service-time.ts
 *
 * This does not connect to Redis. It mirrors the queue lifecycle rolling-average
 * logic with an in-memory mock store so the behavior can be verified locally.
 */

{
  type TestCase = {
    label: string;
    serviceTimeMs: number;
  };

  const DEFAULT_AVG_SERVICE_MS = 60_000;
  const showScopeId = "test-average-service-time:test-sched";

  const testCases: TestCase[] = [
    { label: "short turn", serviceTimeMs: 30_000 },
    { label: "normal turn", serviceTimeMs: 75_000 },
    { label: "long turn", serviceTimeMs: 120_000 },
    { label: "very short turn", serviceTimeMs: 15_000 },
  ];

  const boundaryCase: TestCase = {
    label: "sub-second turn",
    serviceTimeMs: 250,
  };

  const rollingAverage = (previousAvg: number, sampleMs: number) =>
    Math.round(previousAvg * 0.9 + sampleMs * 0.1);

  class MockRedis {
    private store = new Map<string, string>();

    async set(key: string, value: string | number) {
      this.store.set(key, String(value));
    }

    async get(key: string) {
      return this.store.get(key) ?? null;
    }

    async del(...keys: string[]) {
      for (const key of keys) {
        this.store.delete(key);
      }
    }

    snapshot() {
      return new Map(this.store);
    }
  }

  async function completeActiveSessionAndPromoteNextMock({
    redis,
    showScopeId: currentShowScopeId,
    session,
  }: {
    redis: MockRedis;
    showScopeId: string;
    session: {
      ticketId: string;
      userId: string;
      startedAt: number;
    };
  }) {
    const avgKey = `seatwise:metrics:avg_service_ms:${currentShowScopeId}`;
    const rawAvg = await redis.get(avgKey);
    const currentAvg =
      typeof rawAvg === "string" && rawAvg.trim()
        ? Number.parseInt(rawAvg, 10)
        : DEFAULT_AVG_SERVICE_MS;

    const thisUserTimeMs = Math.max(1000, Date.now() - session.startedAt);
    const newAvg = rollingAverage(currentAvg, thisUserTimeMs);
    await redis.set(avgKey, newAvg);

    return {
      promoted: false,
      currentAvg,
      thisUserTimeMs,
      newAvg,
    };
  }

  async function main() {
    console.log("Testing queue service-time averaging with a local mock...\n");

    const redis = new MockRedis();
    const avgKey = `seatwise:metrics:avg_service_ms:${showScopeId}`;

    await redis.del(avgKey);
    await redis.set(avgKey, DEFAULT_AVG_SERVICE_MS);

    let currentAvg = DEFAULT_AVG_SERVICE_MS;

    for (let index = 0; index < testCases.length; index += 1) {
      const testCase = testCases[index];
      const startedAt = Date.now() - testCase.serviceTimeMs;

      const result = await completeActiveSessionAndPromoteNextMock({
        redis,
        showScopeId,
        session: {
          ticketId: `test-ticket-${index + 1}`,
          userId: `test-user-${index + 1}`,
          startedAt,
        },
      });

      const storedAvgRaw = await redis.get(avgKey);
      const storedAvg =
        typeof storedAvgRaw === "string" && storedAvgRaw.trim()
          ? Number.parseInt(storedAvgRaw, 10)
          : NaN;
      const expectedAvg = rollingAverage(currentAvg, result.thisUserTimeMs);
      const pass = storedAvg === expectedAvg;

      console.log(`Case ${index + 1}: ${testCase.label}`);
      console.log(`  simulated service time: ${result.thisUserTimeMs} ms`);
      console.log(`  previous avg: ${currentAvg} ms`);
      console.log(`  expected avg: ${expectedAvg} ms`);
      console.log(`  stored avg: ${storedAvg} ms`);
      console.log(`  status: ${pass ? "PASS" : "FAIL"}\n`);

      currentAvg = expectedAvg;
    }

    const finalAvgRaw = await redis.get(avgKey);
    const finalAvg =
      typeof finalAvgRaw === "string" && finalAvgRaw.trim()
        ? Number.parseInt(finalAvgRaw, 10)
        : NaN;

    console.log(`Final average stored in mock Redis: ${finalAvg} ms`);
    console.log("\nBoundary check:");
    const boundaryRedis = new MockRedis();
    const boundaryAvgKey = `seatwise:metrics:avg_service_ms:${showScopeId}:boundary`;
    await boundaryRedis.set(boundaryAvgKey, DEFAULT_AVG_SERVICE_MS);
    const boundaryStartedAt = Date.now() - boundaryCase.serviceTimeMs;
    const boundaryResult = await completeActiveSessionAndPromoteNextMock({
      redis: boundaryRedis,
      showScopeId: `${showScopeId}:boundary`,
      session: {
        ticketId: "boundary-ticket",
        userId: "boundary-user",
        startedAt: boundaryStartedAt,
      },
    });
    const boundaryExpected = rollingAverage(
      DEFAULT_AVG_SERVICE_MS,
      Math.max(1000, Date.now() - boundaryStartedAt),
    );
    const boundaryStoredRaw = await boundaryRedis.get(boundaryAvgKey);
    const boundaryStored =
      typeof boundaryStoredRaw === "string" && boundaryStoredRaw.trim()
        ? Number.parseInt(boundaryStoredRaw, 10)
        : NaN;
    console.log(`  simulated service time: ${boundaryResult.thisUserTimeMs} ms`);
    console.log(`  expected avg: ${boundaryExpected} ms`);
    console.log(`  stored avg: ${boundaryStored} ms`);
    console.log(`  status: ${boundaryStored === boundaryExpected ? "PASS" : "FAIL"}`);
    console.log(`Mock keys remaining: ${redis.snapshot().size}`);
    console.log("Done.");
  }

  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Average service-time mock test failed:", error);
      process.exit(1);
    });
}
