'use client';

import { useState } from "react";
import { Footprints, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { ScheduleSelectionDialog } from "@/components/queue/ScheduleSelectionDialog";
import { Button } from "@/components/ui/button";
import type { SchedulePickerOption } from "@/lib/shows/schedulePicker";

interface AdminWalkInButtonProps {
  showId: string;
  showName: string;
  schedules: SchedulePickerOption[];
}

export function AdminWalkInButton({
  showId,
  showName,
  schedules,
}: AdminWalkInButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isRouting, setIsRouting] = useState(false);

  const handleConfirm = async (schedId: string) => {
    setIsRouting(true);
    setIsOpen(false);
    router.push(`/admin/walk-in/${showId}/${schedId}`);
  };

  return (
    <>
      <Button
        size="lg"
        variant="outline"
        className="w-full gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
        onClick={() => setIsOpen(true)}
      >
        {isRouting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Footprints className="h-5 w-5" />}
        Walk In
      </Button>

      <ScheduleSelectionDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (isRouting) return;
          setIsOpen(open);
        }}
        showName={showName}
        schedules={schedules}
        confirmButtonLabel="Confirm & Start Walk-In"
        confirmLoadingLabel="Opening walk-in room..."
        onConfirm={handleConfirm}
      />
    </>
  );
}
