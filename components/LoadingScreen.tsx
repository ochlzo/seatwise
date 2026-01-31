"use client";

import { useAppSelector } from "@/lib/hooks";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export default function LoadingScreen() {
  const isLoading = useAppSelector((state) => state.loading.isLoading);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-background"
        >
          <div className="relative w-full h-full max-w-2xl max-h-2xl">
            <Image
              src="/seatwise-loading-screen.gif"
              alt="Loading..."
              fill
              className="object-contain"
              priority
              unoptimized
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
