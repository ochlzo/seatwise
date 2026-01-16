"use client";

import Link from "next/link";

export default function BucalSeatReservationAppPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16 md:px-10">
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
          BUCAL Seat Reservation App
        </h1>
        <p className="max-w-3xl text-lg text-zinc-700 md:text-xl">
          Seatwise powers the BUCAL seat reservation app for campus events and
          performances. It streamlines seat selection, availability, and admin
          management for organizers.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-zinc-600">
          <span className="rounded-full border border-zinc-200 px-3 py-1">
            bucal seat reservation app
          </span>
          <span className="rounded-full border border-zinc-200 px-3 py-1">
            seat reservation app
          </span>
          <span className="rounded-full border border-zinc-200 px-3 py-1">
            campus event booking
          </span>
        </div>
        <div className="flex gap-4 pt-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800"
          >
            Back to Home
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-md border border-zinc-300 px-4 py-2 text-zinc-900 hover:border-zinc-600"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
