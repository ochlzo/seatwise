'use client';

import { useAppSelector } from '@/lib/hooks';
import { motion, AnimatePresence } from 'framer-motion';

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
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
                >
                    <img
                        src="/seatwise-loading-screen.gif"
                        alt="Loading..."
                        className="max-h-full max-w-full"
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
