import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Seatwise",
  description: "Seatwise Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 md:px-12">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div className="space-y-3">
          <h1 className="font-brand text-4xl font-bold tracking-tight md:text-5xl">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Effective date: March 1, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Information We Collect</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            Seatwise may collect account details, reservation records, payment
            proof uploads, and usage logs required to provide seat reservation,
            queueing, and administrative functions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. How We Use Information</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            We use collected data to manage events and reservations, process and
            verify payments, maintain queue sessions, provide customer support,
            and improve platform reliability and security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Data Sharing</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            We do not sell personal data. Information may be shared with service
            providers needed to operate Seatwise, such as hosting, database,
            authentication, and messaging infrastructure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Data Retention</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            We retain data only as long as necessary for operational, legal, and
            auditing purposes. Retention periods may vary based on event,
            payment, and compliance requirements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Security</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            We apply reasonable technical and organizational safeguards to
            protect information from unauthorized access, disclosure, alteration,
            or destruction.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Your Rights</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            You may request access, correction, or deletion of your personal
            information, subject to legal and operational limits.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Contact</h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
            For privacy inquiries, contact the Seatwise team through the official
            support channel used for your deployment.
          </p>
        </section>

        <div className="pt-2">
          <Link
            href="/terms-of-service"
            className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View Terms of Service
          </Link>
        </div>
      </div>
    </main>
  );
}
