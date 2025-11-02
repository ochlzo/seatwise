'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { QueueStatus } from "@/components/QueueStatus";
import { useQueue } from "@/hooks/useQueue";
import { ensureSessionId, getStoredUser, LocalUser } from "@/lib/auth";

const PAGE_ID = "reservation";
const COMPLETE_MESSAGE_KEY = "reservation:completed";
const EXPIRED_MESSAGE_KEY = "reservation:expired";

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [joining, setJoining] = useState(false);
  const [banner, setBanner] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
    }
    setLoadingUser(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const expired = window.sessionStorage.getItem(EXPIRED_MESSAGE_KEY);
    const completed = window.sessionStorage.getItem(COMPLETE_MESSAGE_KEY);

    if (expired) {
      setBanner({ text: "Your reservation hold expired.", tone: "error" });
      window.sessionStorage.removeItem(EXPIRED_MESSAGE_KEY);
    } else if (completed) {
      setBanner({ text: "Reservation complete!", tone: "success" });
      window.sessionStorage.removeItem(COMPLETE_MESSAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!banner) {
      return;
    }

    const timer = window.setTimeout(() => setBanner(null), 5000);
    return () => window.clearTimeout(timer);
  }, [banner]);

  const queue = useQueue(PAGE_ID, user);

  useEffect(() => {
    if (queue.status.state === "active") {
      router.replace("/reservation");
    }
  }, [queue.status.state, router]);

  const handleJoin = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    ensureSessionId();
    setJoining(true);
    await queue.join();
    setJoining(false);
  };

  const joined = queue.joined || queue.status.state !== "idle";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">
            Seatwise Reservation Queue
          </h1>
          <p className="text-sm text-slate-600">
            This proof of concept shows a whole-page reservation queue backed by Upstash
            Redis on the edge runtime.
          </p>
        </header>

        {banner && (
          <div
            className={`rounded-md px-4 py-3 text-sm ${
              banner.tone === "success"
                ? "border border-green-200 bg-green-50 text-green-700"
                : "border border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {banner.text}
          </div>
        )}

        {queue.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {queue.error}
          </div>
        )}

        {!loadingUser && !user && (
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            You're not signed in.{" "}
            <Link href="/login" className="font-medium text-slate-900 underline">
              Go to login
            </Link>{" "}
            to choose a user ID.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Test queue</h2>
              <p className="text-sm text-slate-600">
                Click the button to join the reservation queue for this page.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleJoin}
                disabled={joining || !user}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {joining ? "Joining..." : "Test queue"}
              </button>
              {user && (
                <p className="text-xs text-slate-500">
                  Signed in as <span className="font-medium text-slate-700">{user.name}</span>
                </p>
              )}
            </div>
          </div>

          {joined && (
            <div className="mt-6">
              <QueueStatus
                state={queue.status.state}
                position={
                  queue.status.state === "waiting" ? queue.status.position : undefined
                }
                etaMs={
                  queue.status.state === "waiting" ? queue.status.etaMs : undefined
                }
                msLeft={
                  queue.status.state === "active" ? queue.status.msLeft : undefined
                }
                liveCount={queue.status.liveCount}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
