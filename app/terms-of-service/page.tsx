import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Seatwise",
  description: "Seatwise Terms of Service",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 md:px-12">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div className="space-y-3">
          <h1 className="font-brand text-4xl font-bold tracking-tight md:text-5xl">
            Terms of Service
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Effective date: March 1, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            By accessing or using Seatwise, you agree to these Terms of Service
            and applicable policies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Service Description</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            Seatwise provides event queueing, seat reservation, and payment
            verification workflows for organizers and attendees.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. User Responsibilities</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            Users must provide accurate information, follow reservation and
            payment instructions, and avoid misuse, abuse, or unauthorized
            access attempts.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Payments and Reservations</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            Reservation completion may require verified payment proof. Seat
            availability, queue priority, and reservation confirmation are
            subject to system status and organizer rules.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Service Availability</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            We aim for reliable operation but do not guarantee uninterrupted,
            error-free availability at all times.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Limitation of Liability</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            To the maximum extent permitted by law, Seatwise is not liable for
            indirect, incidental, or consequential damages arising from use of
            the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Changes to Terms</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            We may update these terms from time to time. Continued use of
            Seatwise after updates constitutes acceptance of the revised terms.
          </p>
        </section>

        <div className="pt-2">
          <Link
            href="/privacy-policy"
            className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}
