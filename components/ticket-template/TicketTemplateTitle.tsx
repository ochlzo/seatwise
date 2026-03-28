"use client";

import { Edit2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { setTitle } from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function TicketTemplateTitle({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const title = useAppSelector((state) => state.ticketTemplate.title);

  return (
    <div className={cn("group flex items-center gap-2", className)}>
      <div className="relative flex items-center">
        <Input
          value={title}
          onChange={(event) => dispatch(setTitle(event.target.value))}
          placeholder="Template title"
          className="h-8 w-[180px] bg-zinc-50 pr-8 text-sm font-semibold transition-all focus-visible:ring-1 focus-visible:ring-blue-500 md:w-[320px] dark:bg-zinc-800/50"
        />
        <Edit2 className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-zinc-400 transition-colors group-hover:text-blue-500" />
      </div>
    </div>
  );
}
