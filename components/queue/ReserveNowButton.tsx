'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Ticket, Loader2, CalendarDays } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type Schedule = {
    sched_id: string;
    sched_date: string | Date;
    sched_start_time: string | Date;
    sched_end_time: string | Date;
};

interface ReserveNowButtonProps {
    showId: string;
    showName: string;
    schedules: Schedule[];
}

export function ReserveNowButton({
    showId,
    showName,
    schedules,
}: ReserveNowButtonProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedSchedId, setSelectedSchedId] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    const formatDate = (date: string | Date) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(d);
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
        if (schedules.length === 1) {
            // If only one schedule, skip dialog and join directly
            handleJoinQueue(schedules[0].sched_id || '');
        } else {
            // Show schedule selection dialog
            setIsOpen(true);
        }
    };

    const handleJoinQueue = async (schedId: string) => {
        setIsJoining(true);
        try {
            // TODO: Implement queue joining logic in Phase 2
            // const response = await fetch('/api/queue/join', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ showId, schedId }),
            // });

            // if (!response.ok) throw new Error('Failed to join queue');

            // const data = await response.json();

            // Temporary: Just show a toast and redirect
            toast.success('Joining queue...', {
                description: 'Queue system will be implemented in Phase 2',
            });

            // TODO: Redirect to queue page
            // router.push(`/queue/${showId}/${schedId}`);

            setIsOpen(false);
        } catch (error) {
            toast.error('Failed to join queue', {
                description: error instanceof Error ? error.message : 'Please try again',
            });
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <>
            <Button
                size="lg"
                className="w-full sm:w-auto gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all"
                onClick={handleReserveClick}
            >
                <Ticket className="h-5 w-5" />
                Reserve Now
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Select a Schedule</DialogTitle>
                        <DialogDescription>
                            Choose which date and time you'd like to attend {showName}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
                        {schedules.map((sched) => (
                            <Card
                                key={sched.sched_id}
                                className={`cursor-pointer transition-all hover:shadow-md ${selectedSchedId === sched.sched_id
                                        ? 'ring-2 ring-blue-600 bg-blue-50 dark:bg-blue-950/20'
                                        : 'hover:bg-muted/50'
                                    }`}
                                onClick={() => setSelectedSchedId(sched.sched_id || '')}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">
                                                    {formatDate(sched.sched_date)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-muted-foreground pl-6">
                                                {formatTime(sched.sched_start_time)} -{' '}
                                                {formatTime(sched.sched_end_time)}
                                            </div>
                                        </div>
                                        {selectedSchedId === sched.sched_id && (
                                            <Badge variant="default" className="bg-blue-600">
                                                Selected
                                            </Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                            disabled={isJoining}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedSchedId && handleJoinQueue(selectedSchedId)}
                            disabled={!selectedSchedId || isJoining}
                            className="gap-2"
                        >
                            {isJoining && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isJoining ? 'Joining...' : 'Join Queue'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
