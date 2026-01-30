"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Construction, ArrowLeft, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function ComingSoonClient() {
    const router = useRouter();

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-background">
            {/* Decorative Background Elements */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10 animate-pulse delay-700" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-md w-full"
            >
                <div className="flex justify-center mb-8 relative">
                    <motion.div
                        initial={{ scale: 0.8, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.8, type: "spring" }}
                        className="p-6 rounded-3xl bg-primary/10 border border-primary/20 backdrop-blur-sm relative"
                    >
                        <Construction className="w-16 h-16 text-primary" />
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [1, 0.8, 1],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="absolute -top-2 -right-2 p-2 rounded-full bg-blue-600 text-white shadow-lg"
                        >
                            <Sparkles className="w-4 h-4" />
                        </motion.div>
                    </motion.div>
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent italic">
                    COMING SOON
                </h1>

                <p className="text-muted-foreground text-lg mb-8 max-w-sm mx-auto font-medium">
                    We&apos;re currently building this feature to give you the best experience. Stay tuned!
                </p>

                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                        <Clock className="w-3 h-3" />
                        Under Development
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => router.back()}
                            className="group transition-all hover:bg-primary hover:text-primary-foreground border-primary/20"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                            Go Back
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => router.push('/admin')}
                            className="shadow-lg shadow-primary/20"
                        >
                            Admin Dashboard
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* Progress Bar Illusion */}
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: "200px" }}
                transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
                className="h-1 bg-primary/20 rounded-full mt-12 overflow-hidden"
            >
                <motion.div
                    animate={{ x: [-200, 200] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="h-full w-20 bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                />
            </motion.div>
        </div>
    );
}
