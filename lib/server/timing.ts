type TimingEntry = {
  phase: string;
  durationMs: number;
  atMs: number;
  detail?: Record<string, unknown>;
};

type RouteTimerOptions = {
  enabled?: boolean;
  context?: Record<string, unknown>;
};

const roundMs = (value: number) => Math.round(value * 100) / 100;

export function isRouteTimingEnabled(request: Request) {
  const header = request.headers.get("x-seatwise-debug-timing");
  const search = new URL(request.url).searchParams.get("debugTiming");

  return (
    process.env.SEATWISE_API_TIMING === "1" ||
    header === "1" ||
    search === "1"
  );
}

export function createRouteTimer(
  routeName: string,
  options: RouteTimerOptions = {},
) {
  const enabled = options.enabled ?? process.env.SEATWISE_API_TIMING === "1";
  const startedAt = performance.now();
  const entries: TimingEntry[] = [];

  const push = (
    phase: string,
    durationMs: number,
    detail?: Record<string, unknown>,
  ) => {
    if (!enabled) return;

    entries.push({
      phase,
      durationMs: roundMs(durationMs),
      atMs: roundMs(performance.now() - startedAt),
      detail,
    });
  };

  return {
    async time<T>(
      phase: string,
      run: () => Promise<T>,
      detail?: Record<string, unknown>,
    ): Promise<T> {
      const phaseStartedAt = performance.now();
      try {
        return await run();
      } finally {
        push(phase, performance.now() - phaseStartedAt, detail);
      }
    },

    mark(phase: string, detail?: Record<string, unknown>) {
      push(phase, 0, detail);
    },

    flush(detail?: Record<string, unknown>) {
      if (!enabled) return;

      const totalMs = roundMs(performance.now() - startedAt);
      console.info(
        `[route-timing] ${routeName} ${JSON.stringify({
          route: routeName,
          totalMs,
          phases: entries,
          ...options.context,
          ...detail,
        })}`,
      );
    },
  };
}
