"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
} as const;

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
} as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 selection:bg-blue-100 dark:selection:bg-blue-900/30">

      {/* 1. HERO SECTION */}
      <main className="flex flex-col items-center justify-center px-6 py-32 text-center lg:py-48 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative will-change-transform"
        >
          {/* Decorative background glow - reduced blur for performance */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-500/10 blur-[80px] rounded-full -z-10 transform-gpu" />

          <motion.h1
            {...fadeInUp}
            className="max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl"
          >
            Seatwise: Smarter Seating for <span className="text-blue-600 dark:text-blue-400">Every Event</span>
          </motion.h1>

          <motion.p
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.2 }}
            className="mt-8 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400 mx-auto"
          >
            Streamline your campus and community events. Eliminate manual check-in bottlenecks, prevent double bookings, and manage attendance with secure QR tickets.
          </motion.p>

          <motion.div
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.4 }}
            className="mt-10 flex items-center justify-center gap-x-6"
          >
            <Link
              href="/dashboard"
              className="group relative rounded-full bg-zinc-900 dark:bg-white px-8 py-4 text-sm font-semibold text-white dark:text-black shadow-lg hover:shadow-blue-500/20 transition-all hover:-translate-y-0.5"
            >
              Get Started
            </Link>
            <Link
              href="#features"
              className="text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Learn more <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </motion.div>
        </motion.div>
      </main>

      {/* 2. FEATURE HIGHLIGHTS SECTION */}
      <section id="features" className="py-24 bg-white dark:bg-zinc-900/50 transition-colors duration-500 transform-gpu">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-base font-semibold leading-7 text-blue-600 dark:text-blue-400 uppercase tracking-wider">Why Seatwise?</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Everything you need to manage venue crowds
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-50px" }}
            className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none"
          >
            <dl className="grid max-w-xl grid-cols-1 gap-x-12 gap-y-16 lg:max-w-none lg:grid-cols-3">

              {[
                {
                  title: "Interactive Seat Maps",
                  description: "Design custom layouts for your venue. Attendees can visualize the space and pick their exact spot, eliminating confusion on event day."
                },
                {
                  title: "Secure QR Entry",
                  description: "Say goodbye to paper lists. Validate tickets instantly with our secure scanner that prevents duplicate usage and tracks entry/exit logs."
                },
                {
                  title: "Smart Queue System",
                  description: "Fairness built-in. Our 5-minute hold system protects selections while users checkout, preventing race conditions and frustration."
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="flex flex-col p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 hover:border-blue-500/50 transition-colors duration-300"
                >
                  <dt className="flex items-center gap-x-3 text-lg font-semibold leading-7 text-zinc-900 dark:text-white">
                    <div className="h-2 w-2 rounded-full bg-blue-600" />
                    {feature.title}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-zinc-600 dark:text-zinc-400">
                    <p className="flex-auto italic font-light">
                      {feature.description}
                    </p>
                  </dd>
                </motion.div>
              ))}

            </dl>
          </motion.div>
        </div>
      </section>

      {/* Footer Placeholder */}
      <footer className="py-20 text-center text-sm text-zinc-500 dark:text-zinc-500">
        <p className="font-medium">&copy; 2026 Seatwise. All rights reserved.</p>
        <div className="mt-4 flex justify-center gap-6">
          <Link href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
          <Link href="#" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
        </div>
      </footer>

    </div>
  );
}
