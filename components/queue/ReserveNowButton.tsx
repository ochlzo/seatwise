'use client';

import { useState } from 'react';
import { Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { toast } from "@/components/ui/sonner";
import { ScheduleSelectionDialog } from '@/components/queue/ScheduleSelectionDialog';
import { getOrCreateGuestId } from "@/lib/guest";
import { setJoinTransitionState } from "@/lib/queue/joinTransition";
import type { SchedulePickerOption } from "@/lib/shows/schedulePicker";

interface ReserveNowButtonProps {
  showId: string;
  showName: string;
  schedules: SchedulePickerOption[];
}

type JoinPhase =
  | 'idle'
  | 'joining_queue'
  | 'processing_response'
  | 'saving_session'
  | 'redirecting';

export function ReserveNowButton({
  showId,
  showName,
  schedules,
}: ReserveNowButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [joinPhase, setJoinPhase] = useState<JoinPhase>('idle');
  const isJoining = joinPhase !== 'idle';

  const handleJoinQueue = async (selectedSchedId: string) => {
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
        const message = data.error || 'Failed to join queue';

        if (data.pauseReason === 'walk_in') {
          toast.warning('Queue temporarily paused', {
            description: message,
          });
          setJoinPhase('idle');
          return;
        }

        throw new Error(message);
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
        setJoinTransitionState(showScopeId);
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
      throw error;
    }
  };

  return (
    <>
      <Button
        size="lg"
        className="w-full gap-2 bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-xl"
        onClick={() => setIsOpen(true)}
      >
        <Ticket className="h-5 w-5" />
        Reserve Now
      </Button>

      <ScheduleSelectionDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (isJoining) return;
          setIsOpen(open);
          if (!open) {
            setJoinPhase('idle');
          }
        }}
        showName={showName}
        schedules={schedules}
        confirmButtonLabel="Confirm & Join Queue"
        confirmLoadingLabel={
          joinPhase === 'joining_queue'
            ? 'Joining queue...'
            : joinPhase === 'processing_response'
              ? 'Processing response...'
              : joinPhase === 'saving_session'
                ? 'Preparing reservation room...'
                : 'Redirecting...'
        }
        onConfirm={handleJoinQueue}
      />
    </>
  );
}
