"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ensureSessionId, LocalUser } from "@/lib/auth";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/redis";

type QueueDisplayState =
  | { state: "idle"; liveCount: number }
  | {
      state: "waiting";
      position: number;
      etaMs: number;
      liveCount: number;
    }
  | {
      state: "active";
      msLeft: number;
      liveCount: number;
    };

type HeartbeatResponse = {
  state: "idle" | "waiting" | "active";
  liveCount: number;
  position?: number;
  etaMs?: number;
  msLeft?: number;
};

type JoinOutcome = "active" | "waiting" | null;

type UseQueueResult = {
  status: QueueDisplayState;
  join: () => Promise<JoinOutcome>;
  leave: () => Promise<void>;
  joined: boolean;
  sessionId: string | null;
  error: string | null;
  refreshing: boolean;
  hasSnapshot: boolean;
};

export function useQueue(
  pageId: string,
  user: LocalUser | null
): UseQueueResult {
  const detailRef = useRef<{
    pageId: string;
    userId: string;
    sessionId: string;
    name: string;
  } | null>(null);

  const snapshotRef = useRef<{
    payload: HeartbeatResponse;
    receivedAt: number;
  } | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<QueueDisplayState>({
    state: "idle",
    liveCount: 0,
  });
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const joinedFlagKey = useMemo(() => `queue:${pageId}:joined`, [pageId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const flag = window.sessionStorage.getItem(joinedFlagKey);
    setJoined(flag === "1");
  }, [joinedFlagKey]);

  useEffect(() => {
    if (!user) {
      detailRef.current = null;
      setSessionId(null);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const sessionId = ensureSessionId();
    detailRef.current = {
      pageId,
      userId: user.userId,
      sessionId,
      name: user.name,
    };
    setSessionId(sessionId);
  }, [pageId, user]);

  const applySnapshot = useCallback((payload: HeartbeatResponse) => {
    const receivedAt = Date.now();
    snapshotRef.current = { payload, receivedAt };
    setHasSnapshot(true);

    setStatus((prev) => {
      if (payload.state === "idle") {
        return { state: "idle", liveCount: payload.liveCount };
      }

      if (payload.state === "waiting") {
        return {
          state: "waiting",
          position: payload.position ?? 1,
          etaMs: payload.etaMs ?? 0,
          liveCount: payload.liveCount,
        };
      }

      return {
        state: "active",
        msLeft: payload.msLeft ?? 0,
        liveCount: payload.liveCount,
      };
    });
  }, []);

  useEffect(() => {
    const tick = () => {
      const snapshot = snapshotRef.current;
      if (!snapshot) {
        return;
      }

      const elapsed = Date.now() - snapshot.receivedAt;
      const { payload } = snapshot;

      if (payload.state === "waiting") {
        const etaMs = Math.max(0, (payload.etaMs ?? 0) - elapsed);
        setStatus((current) => {
          if (current.state !== "waiting") {
            return {
              state: "waiting",
              position: payload.position ?? 1,
              etaMs,
              liveCount: payload.liveCount,
            };
          }

          return {
            state: "waiting",
            position: payload.position ?? current.position,
            etaMs,
            liveCount: payload.liveCount,
          };
        });
      } else if (payload.state === "active") {
        const msLeft = Math.max(0, (payload.msLeft ?? 0) - elapsed);
        setStatus((current) => {
          if (current.state !== "active") {
            return { state: "active", msLeft, liveCount: payload.liveCount };
          }

          return { state: "active", msLeft, liveCount: payload.liveCount };
        });
      }
    };

    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const sendHeartbeat = useCallback(async () => {
    const details = detailRef.current;
    if (!details) {
      return;
    }

    setRefreshing(true);
    try {
      const res = await fetch("/api/queue/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageId: details.pageId,
          userId: details.userId,
          sessionId: details.sessionId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Heartbeat failed: ${res.status}`);
      }

      const payload = (await res.json()) as HeartbeatResponse;
      applySnapshot(payload);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    if (!joined) {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }

    if (!detailRef.current) {
      return;
    }

    void sendHeartbeat();

    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [joined, sessionId, sendHeartbeat]);

  const join = useCallback(async () => {
    const details = detailRef.current;
    if (!details) {
      setError("Missing user information.");
      return null;
    }

    try {
      const res = await fetch("/api/queue/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageId: details.pageId,
          userId: details.userId,
          sessionId: details.sessionId,
          name: details.name,
        }),
      });

      if (res.status === 409) {
        setError("Another tab is active for this account.");
        return null;
      }

      if (!res.ok) {
        setError(`Join failed (${res.status})`);
        return null;
      }

      const payload = (await res.json()) as { ok: boolean; active?: boolean };
      const becameActive = Boolean(payload.active);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(joinedFlagKey, "1");
      }

      setJoined(true);
      setError(null);
      await sendHeartbeat();
      return becameActive ? "active" : "waiting";
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [joinedFlagKey, sendHeartbeat]);

  const leave = useCallback(async () => {
    const details = detailRef.current;
    if (!details) {
      return;
    }

    try {
      await fetch("/api/queue/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageId: details.pageId,
          userId: details.userId,
          sessionId: details.sessionId,
        }),
      });
    } finally {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(joinedFlagKey);
      }
      snapshotRef.current = null;
      setJoined(false);
      setStatus({ state: "idle", liveCount: 0 });
      setHasSnapshot(false);
    }
  }, [joinedFlagKey]);

  useEffect(() => {
    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, []);

  return {
    status,
    join,
    leave,
    joined,
    sessionId,
    error,
    refreshing,
    hasSnapshot,
  };
}
