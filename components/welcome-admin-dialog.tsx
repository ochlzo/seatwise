"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";

export function WelcomeAdminDialog() {
    const [isOpen, setIsOpen] = React.useState(false);

    React.useEffect(() => {
        // Check if we've already shown the welcome message in this session
        const hasBeenWelcomed = sessionStorage.getItem("admin_welcomed");

        if (!hasBeenWelcomed) {
            const timer = setTimeout(() => {
                setIsOpen(true);
                sessionStorage.setItem("admin_welcomed", "true");
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    return (
        <AnimatePresence>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md border-none p-0 overflow-hidden bg-transparent shadow-none">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-background border rounded-2xl shadow-2xl overflow-hidden relative"
                    >
                        {/* Decorative Top Bar */}
                        <div className="h-2 bg-gradient-to-r from-blue-600 via-primary to-blue-400" />

                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <motion.div
                                    initial={{ rotate: -15, scale: 0.5 }}
                                    animate={{ rotate: 0, scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring" }}
                                    className="p-4 rounded-2xl bg-primary/10 relative"
                                >
                                    <ShieldCheck className="w-12 h-12 text-primary" />
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute -top-1 -right-1"
                                    >
                                        <Sparkles className="w-5 h-5 text-blue-500" />
                                    </motion.div>
                                </motion.div>
                            </div>

                            <DialogHeader className="text-center sm:text-center space-y-2">
                                <DialogTitle className="text-3xl font-extrabold tracking-tight italic">
                                    WELCOME <span className="text-primary">ADMIN</span>
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-base max-w-[280px] mx-auto">
                                    Access granted. You now have full control over the Seatwise system.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-8">
                                <Button
                                    onClick={() => setIsOpen(false)}
                                    className="w-full h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
                                >
                                    Get Started
                                </Button>
                            </div>
                        </div>

                        {/* Background Decorations */}
                        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
                    </motion.div>
                </DialogContent>
            </Dialog>
        </AnimatePresence>
    );
}
