'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useQueue } from "@/hooks/useQueue";
import { getStoredUser, LocalUser } from "@/lib/auth";

const PAGE_ID = "reservation";
const COMPLETE_MESSAGE_KEY = "reservation:completed";
const EXPIRED_MESSAGE_KEY = "reservation:expired";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  const { joined, hasSnapshot, status, leave, sessionId } = queue;

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
    if (!joined || !hasSnapshot || redirecting) {
      return;
    }

    if (status.state !== "active") {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(EXPIRED_MESSAGE_KEY, "1");
      }
      setRedirecting(true);
      void (async () => {
        await leave();
        router.replace("/");
      })();
    }
  }, [joined, hasSnapshot, status.state, leave, router, redirecting]);

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
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-200">Reservation hold</p>
          <h1 className="mt-2 text-6xl font-semibold">{countdown}</h1>
        </div>
        <button
          onClick={handleSubmit}
          disabled={status.state !== "active" || submitting}
          className="w-full rounded-full bg-lime-400 px-6 py-3 text-lg font-semibold text-slate-900 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-200"
        >
          {submitting ? "Submitting..." : "Submit reservation"}
        </button>
        <p className="text-xs text-slate-200">
          Complete your reservation before the timer runs out or you will lose the spot.
        </p>
      </div>
    </div>
  );
}
