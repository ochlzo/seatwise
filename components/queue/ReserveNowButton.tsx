'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Ticket, Loader2, ChevronLeft } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from "@/components/ui/sonner";
import { useRouter } from 'next/navigation';
import { getOrCreateGuestId } from "@/lib/guest";

type CategoryInfo = {
    name: string;
    price: string;
};

type Schedule = {
    sched_id: string;
    sched_date: string | Date;
    sched_start_time: string | Date;
    sched_end_time: string | Date;
    effective_status?: "OPEN" | "ON_GOING" | "FULLY_BOOKED" | "CLOSED";
    categories?: CategoryInfo[];
};

const SCHEDULE_STATUS_LABELS: Record<NonNullable<Schedule["effective_status"]>, string> = {
    OPEN: "Open",
    ON_GOING: "On Going",
    FULLY_BOOKED: "Fully Booked",
    CLOSED: "Closed",
};

interface ReserveNowButtonProps {
    showId: string;
    showName: string;
    schedules: Schedule[];
}

type Step = 'date' | 'time';
type JoinPhase = 'idle' | 'joining_queue' | 'processing_response' | 'saving_session' | 'redirecting';

export function ReserveNowButton({
    showId,
    showName,
    schedules,
}: ReserveNowButtonProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<Step>('date');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedSchedId, setSelectedSchedId] = useState<string | null>(null);
    const [joinPhase, setJoinPhase] = useState<JoinPhase>('idle');
    const isJoining = joinPhase !== 'idle';

    const joinButtonLabel = (() => {
        switch (joinPhase) {
            case 'joining_queue':
                return 'Joining queue...';
            case 'processing_response':
                return 'Processing response...';
            case 'saving_session':
                return 'Preparing reservation room...';
            case 'redirecting':
                return 'Redirecting...';
            default:
                return 'Confirm & Join Queue';
        }
    })();

    const parseLocalDate = (dateStr: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const schedulesByDate = useMemo(() => {
        const grouped = new Map<string, Schedule[]>();
        schedules.forEach((sched) => {
            const dateStr = typeof sched.sched_date === 'string'
                ? sched.sched_date.split('T')[0]
                : sched.sched_date.toISOString().split('T')[0];

            if (!grouped.has(dateStr)) {
                grouped.set(dateStr, []);
            }
            grouped.get(dateStr)!.push(sched);
        });
        return grouped;
    }, [schedules]);

    const availableDates = useMemo(() => {
        return Array.from(schedulesByDate.keys()).map((dateStr) => parseLocalDate(dateStr));
    }, [schedulesByDate]);

    const schedulesForSelectedDate = useMemo(() => {
        if (!selectedDate) return [];
        const dateStr = formatLocalDate(selectedDate);
        return schedulesByDate.get(dateStr) || [];
    }, [selectedDate, schedulesByDate]);

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        }).format(date);
    };

    const formatTime = (time: string | Date) => {
        const t = typeof time === 'string' && time.includes('T')
            ? new Date(time)
            : typeof time === 'string'
                ? new Date(`1970-01-01T${time}`)
                : time;

        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(t);
    };

    const handleReserveClick = () => {
        setStep('date');
        setSelectedDate(undefined);
        setSelectedSchedId(null);
        setIsOpen(true);
    };

    const handleDateSelect = (date: Date | undefined) => {
        if (!date) return;
        const dateStr = formatLocalDate(date);
        if (schedulesByDate.has(dateStr)) {
            setSelectedDate(date);
            setSelectedSchedId(null);
        }
    };

    const handleDateConfirm = () => {
        if (!selectedDate) return;
        setStep('time');
    };

    const handleBack = () => {
        setStep('date');
        setSelectedSchedId(null);
    };

    const handleCancel = () => {
        if (isJoining) return;
        setIsOpen(false);
        setStep('date');
        setSelectedDate(undefined);
        setSelectedSchedId(null);
    };

    const handleJoinQueue = async () => {
        if (!selectedSchedId) return;

        setJoinPhase('joining_queue');
        try {
            const guestId = getOrCreateGuestId();
            const response = await fetch('/api/queue/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ showId, schedId: selectedSchedId, guestId }),
            });

            setJoinPhase('processing_response');
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to join queue');
            }

            if (data.status === 'active' && data.ticket?.ticketId && data.activeToken && data.expiresAt) {
                setJoinPhase('saving_session');
                const showScopeId = `${showId}:${selectedSchedId}`;
                const storageKey = `seatwise:active:${showScopeId}:${data.ticket.ticketId}`;
                sessionStorage.setItem(
                    storageKey,
                    JSON.stringify({
                        ticketId: data.ticket.ticketId,
                        activeToken: data.activeToken,
                        expiresAt: data.expiresAt,
                        showScopeId,
                    }),
                );

                toast.success('Your reservation window is active!', {
                    description: 'Proceeding to reservation room...',
                });

                setJoinPhase('redirecting');
                setIsOpen(false);
                router.push(`/reserve/${showId}/${selectedSchedId}`);
                return;
            }

            toast.success('Successfully joined the queue!', {
                description: `You're #${data.rank} in line. Estimated wait: ~${data.estimatedWaitMinutes} min`,
            });

            setJoinPhase('redirecting');
            setIsOpen(false);
            router.push(`/queue/${showId}/${selectedSchedId}`);
        } catch (error) {
            toast.error('Failed to join queue', {
                description: error instanceof Error ? error.message : 'Please try again',
            });
            setJoinPhase('idle');
        }
    };

    const disabledDates = (date: Date) => {
        const dateStr = formatLocalDate(date);
        return !schedulesByDate.has(dateStr);
    };

    return (
        <>
            <Button
                size="lg"
                className="w-full gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all"
                onClick={handleReserveClick}
            >
                <Ticket className="h-5 w-5" />
                Reserve Now
            </Button>

            <Dialog open={isOpen} onOpenChange={(open) => {
                if (isJoining) return;
                setIsOpen(open);
            }}>
                <DialogContent className="sm:max-w-[600px]">
                    {step === 'date' ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-base sm:text-lg">Select a Date</DialogTitle>
                                <DialogDescription className="text-xs sm:text-sm">
                                    Choose which date you&apos;d like to attend {showName}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex justify-center py-4">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={handleDateSelect}
                                    disabled={disabledDates}
                                    className="rounded-md border"
                                    modifiers={{
                                        available: availableDates,
                                    }}
                                    modifiersClassNames={{
                                        available: 'bg-blue-100 dark:bg-blue-900 font-semibold',
                                    }}
                                />
                            </div>

                            <DialogFooter className="flex-row justify-end gap-2">
                                <Button variant="outline" onClick={handleCancel} className="text-xs sm:text-sm">
                                    Cancel
                                </Button>
                                <Button onClick={handleDateConfirm} disabled={!selectedDate} className="text-xs sm:text-sm">
                                    Confirm
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader className="text-left sm:text-left">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleBack}
                                        disabled={isJoining}
                                        className="h-8 w-8"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="min-w-0 flex-1 text-left">
                                        <DialogTitle className="text-base sm:text-lg">Select Time Slot</DialogTitle>
                                        <DialogDescription className="text-xs sm:text-sm">
                                            {selectedDate && formatDate(selectedDate)}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="space-y-3 max-h-[420px] overflow-y-auto py-4 pr-1">
                                <RadioGroup value={selectedSchedId || ''} onValueChange={setSelectedSchedId}>
                                    {schedulesForSelectedDate.map((sched) => {
                                        const categories = sched.categories || [];
                                        const isSchedDisabled =
                                            sched.effective_status === "ON_GOING" ||
                                            sched.effective_status === "FULLY_BOOKED" ||
                                            sched.effective_status === "CLOSED";

                                        return (
                                            <Card
                                                key={sched.sched_id}
                                                className={`transition-all rounded-xl border ${
                                                    isSchedDisabled
                                                        ? 'cursor-not-allowed opacity-60'
                                                        : 'cursor-pointer hover:shadow-md'
                                                } ${
                                                    selectedSchedId === sched.sched_id
                                                        ? 'ring-2 ring-blue-600 bg-blue-50/80 dark:bg-blue-950/20'
                                                        : 'hover:bg-muted/40'
                                                } py-0`}
                                                onClick={() => {
                                                    if (isSchedDisabled) return;
                                                    setSelectedSchedId(sched.sched_id || '');
                                                }}
                                            >
                                                <CardContent className="px-4 py-4">
                                                    <div className="flex items-start gap-2">
                                                        <RadioGroupItem
                                                            value={sched.sched_id || ''}
                                                            id={sched.sched_id}
                                                            className="mt-1 shrink-0"
                                                            disabled={isSchedDisabled}
                                                        />
                                                        <Label
                                                            htmlFor={sched.sched_id}
                                                            className={`flex-1 !items-start !gap-0 ${isSchedDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                        >
                                                            <div className="w-full space-y-3">
                                                                <div className="flex items-start gap-2">
                                                                    <div className="min-w-0 flex-1 space-y-1">
                                                                        <div className="text-sm font-semibold sm:text-base">
                                                                            {formatTime(sched.sched_start_time)} -{' '}
                                                                            {formatTime(sched.sched_end_time)}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {selectedDate && formatDate(selectedDate)}
                                                                        </div>
                                                                    </div>
                                                                    {sched.effective_status && sched.effective_status !== "OPEN" && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="shrink-0 border-transparent text-[10px] uppercase tracking-wide"
                                                                        >
                                                                            {SCHEDULE_STATUS_LABELS[sched.effective_status]}
                                                                        </Badge>
                                                                    )}
                                                                </div>

                                                                {categories.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2 pl-0">
                                                                        {categories.map((category) => (
                                                                            <div
                                                                                key={`${sched.sched_id}-${category.name}`}
                                                                                className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border/60 bg-background px-2.5 py-1 text-[10px] sm:text-xs"
                                                                            >
                                                                                <span className="font-medium">{category.name}</span>
                                                                                <span className="text-muted-foreground whitespace-nowrap">
                                                                                    PHP {Number.parseFloat(category.price).toFixed(2)}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </Label>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </RadioGroup>
                            </div>

                            <DialogFooter className="flex-row justify-end gap-2">
                                <Button variant="outline" onClick={handleCancel} disabled={isJoining} className="text-xs sm:text-sm">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleJoinQueue}
                                    disabled={!selectedSchedId || isJoining}
                                    className="gap-2 text-xs sm:text-sm"
                                >
                                    {isJoining && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {joinButtonLabel}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

