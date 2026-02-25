"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface ReservationSuccessPanelProps {
    showName: string;
    selectedSeatIds: string[];
    seatNumbersById: Record<string, string>;
    showId: string;
}

export function ReservationSuccessPanel({
    showName,
    selectedSeatIds,
    seatNumbersById,
    showId,
}: ReservationSuccessPanelProps) {
    const router = useRouter();

    const handleBackToShow = () => {
        router.push(`/${showId}`);
    };

    return (
        <div className="flex min-h-[50vh] items-center justify-center px-4 py-8">
            <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
                <div className="rounded-full bg-green-100 p-4 text-green-600 dark:bg-green-900/40 dark:text-green-400">
                    <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">Reservation Confirmed</h3>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        Your {selectedSeatIds.length > 0 ? selectedSeatIds.length : ""} seat{selectedSeatIds.length !== 1 ? "s" : ""} for{" "}
                        <span className="font-medium text-foreground">{showName}</span> {selectedSeatIds.length === 1 ? "has" : "have"} been successfully reserved.
                    </p>
                </div>

                {selectedSeatIds.length > 0 && (
                    <div className="w-full rounded-xl border border-sidebar-border bg-sidebar p-5 text-left shadow-sm">
                        <p className="mb-3 text-sm font-semibold text-sidebar-foreground">Reserved Seats</p>
                        <div className="flex flex-wrap gap-2">
                            {selectedSeatIds.map((seatId) => (
                                <div
                                    key={seatId}
                                    className="inline-flex items-center justify-center rounded-md border border-sidebar-border/70 bg-background px-3 py-1.5 text-xs font-semibold shadow-sm"
                                >
                                    <span className="truncate">{seatNumbersById[seatId] ?? seatId}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <Button onClick={handleBackToShow} className="mt-4 w-full sm:w-auto min-w-[200px]" size="lg">
                    Back to Show
                </Button>
            </div>
        </div>
    );
}
