"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { QueueStatus } from "@/components/QueueStatus";
import { useQueue } from "@/hooks/useQueue";
import { getStoredUser, LocalUser } from "@/lib/auth";

const PAGE_ID = "reservation";
const COMPLETE_MESSAGE_KEY = "reservation:completed";
const EXPIRED_MESSAGE_KEY = "reservation:expired";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ReservationPage() {
  const router = useRouter();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const queue = useQueue(PAGE_ID, user);
  const {
    joined,
    hasSnapshot,
    status,
    leave,
    sessionId,
    error,
    join: joinQueue,
  } = queue;

  const wasActiveRef = useRef(false);
  const rejoinAttemptedRef = useRef(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setUser(stored);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (status.state === "active") {
      wasActiveRef.current = true;
    }
  }, [status.state]);

  useEffect(() => {
    if (!hasSnapshot || redirecting) {
      return;
    }

    if (!joined) {
      router.replace("/");
      return;
    }

    if (status.state === "idle" && wasActiveRef.current) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(EXPIRED_MESSAGE_KEY, "1");
      }
      setRedirecting(true);
      void (async () => {
        await leave();
        router.replace("/");
      })();
    }
  }, [hasSnapshot, joined, status.state, leave, router, redirecting]);

  useEffect(() => {
    if (status.state === "active" && status.msLeft <= 0 && !redirecting) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(EXPIRED_MESSAGE_KEY, "1");
      }
      setRedirecting(true);
      void (async () => {
        await leave();
        router.replace("/");
      })();
    }
  }, [status, leave, router, redirecting]);

  const countdown = useMemo(() => {
    if (status.state !== "active") {
      return "--:--";
    }
    return formatDuration(status.msLeft);
  }, [status]);

  useEffect(() => {
    if (status.state !== "idle") {
      rejoinAttemptedRef.current = false;
    }
  }, [status.state]);

  useEffect(() => {
    if (!joined || !hasSnapshot || redirecting) {
      return;
    }

    if (status.state !== "idle") {
      return;
    }

    if (rejoinAttemptedRef.current) {
      return;
    }

    rejoinAttemptedRef.current = true;
    void joinQueue();
  }, [joined, hasSnapshot, status.state, joinQueue]);

  const handleSubmit = async () => {
    if (!user || !sessionId || submitting || redirecting) {
      return;
    }

    setSubmitting(true);
    await delay(350);

    try {
      const res = await fetch("/api/queue/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: PAGE_ID,
          userId: user.userId,
          sessionId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Complete failed (${res.status})`);
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(COMPLETE_MESSAGE_KEY, "1");
      }

      setRedirecting(true);
      await leave();
      router.replace("/");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (redirecting) {
      return;
    }

    setRedirecting(true);
    try {
      await leave();
    } finally {
      router.replace("/");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <span className="animate-pulse text-sm uppercase tracking-[0.3em]">
          Preparing reservation...
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white/10 p-10 text-center text-white shadow-2xl backdrop-blur">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!hasSnapshot && status.state === "idle" && (
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-6 text-sm text-slate-200">
            Setting up your place in line...
          </div>
        )}

        {hasSnapshot && status.state === "idle" && !joined && (
          <div className="space-y-4 rounded-xl border border-white/20 bg-white/5 px-5 py-6 text-left text-slate-200">
            <p className="text-sm font-medium text-white">
              You are not currently in the queue for this reservation.
            </p>
            <p className="text-xs text-slate-300">
              Return to the home page and click{" "}
              <span className="font-semibold">Test queue</span> to join, or wait
              for your promotion if you just submitted your reservation.
            </p>
            <button
              onClick={() => router.replace("/")}
              className="rounded-md border border-white/30 px-3 py-2 text-xs font-semibold text-white hover:border-white"
            >
              Back to home
            </button>
          </div>
        )}

        {hasSnapshot && status.state === "idle" && joined && (
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-6 text-sm text-slate-200">
            Syncing with the queue… hang tight for the latest status.
          </div>
        )}

        {status.state === "waiting" && (
          <div className="space-y-6">
            <QueueStatus
              state="waiting"
              position={status.position}
              etaMs={status.etaMs}
              liveCount={status.liveCount}
            />
            <p className="text-xs text-slate-200">
              Keep this page open. We will move you into the reservation flow as
              soon as it is your turn.
            </p>
            <button
              onClick={handleLeaveQueue}
              className="w-full rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:border-white"
            >
              Leave queue
            </button>
          </div>
        )}

        {status.state === "active" && (
          <div className="space-y-8">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-200">
                Reservation hold
              </p>
              <h1 className="mt-2 text-6xl font-semibold">{countdown}</h1>
            </div>
            <button
              onClick={handleSubmit}
              disabled={status.state !== "active" || submitting}
              className="w-full rounded-full bg-lime-500 px-6 py-3 text-lg font-semibold text-slate-900 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
            >
              {status.state === "active"
                ? submitting
                  ? "Submitting..."
                  : "Submit reservation"
                : "Waiting for your turn..."}
            </button>
            <p className="text-xs text-slate-200">
              Complete your reservation before the timer runs out or you will
              lose the spot.
            </p>
            <QueueStatus
              state="active"
              msLeft={status.msLeft}
              liveCount={status.liveCount}
            />
          </div>
        )}
      </div>
    </div>
  );
}
