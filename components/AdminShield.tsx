"use client";

import { useAppSelector } from "@/lib/hooks";
import { RootState } from "@/lib/store";
import { ShieldCheck } from "lucide-react";

export default function AdminShield() {
    const user = useAppSelector((state: RootState) => state.auth.user);
    const isAdmin = user?.role === "ADMIN";

    if (!isAdmin) return null;

    return (
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 animate-in fade-in zoom-in duration-300">
            <ShieldCheck className="size-3 sm:size-4" />
            <span className="text-[10px] sm:text-xs font-semibold tracking-wide uppercase">Admin Access</span>
        </div>
    );
}
