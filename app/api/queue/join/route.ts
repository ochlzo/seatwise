import { NextRequest, NextResponse } from 'next/server';
import { joinQueue } from '@/lib/queue/joinQueue';
import { getQueuePauseState } from '@/lib/queue/closeQueue';
import { promoteNextInQueue } from '@/lib/queue/queueLifecycle';
import { prisma } from '@/lib/prisma';
import {
    isSchedStatusReservable,
    getEffectiveSchedStatus,
    getEffectiveShowStatus,
} from '@/lib/shows/effectiveStatus';

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

export async function POST(request: NextRequest) {
    try {
        // 1. Parse request body
        const body = await request.json();
        const { showId, schedId, guestId, displayName } = body as {
            showId?: string;
            schedId?: string;
            guestId?: string;
            displayName?: string;
        };

        if (!showId || !schedId || !guestId) {
            return NextResponse.json(
                { success: false, error: 'Missing showId, schedId, or guestId' },
                { status: 400 }
            );
        }

        // 2. Verify show and schedule exist
        const schedule = await prisma.sched.findFirst({
            where: {
                sched_id: schedId,
                show_id: showId,
            },
            select: {
                sched_id: true,
                sched_date: true,
                sched_start_time: true,
                sched_end_time: true,
                status: true,
                show: {
                    select: {
                        show_status: true,
                        show_name: true,
                    },
                },
            },
        });

        if (!schedule) {
            return NextResponse.json(
                { success: false, error: 'Schedule not found' },
                { status: 404 }
            );
        }

        const effectiveShowStatus = getEffectiveShowStatus({
            show_status: schedule.show.show_status,
            scheds: [schedule],
        });
        const effectiveSchedStatus = getEffectiveSchedStatus(schedule);

        if (effectiveShowStatus !== 'OPEN' && effectiveShowStatus !== 'ON_GOING') {
            return NextResponse.json(
                { success: false, error: 'This show is not currently accepting reservations' },
                { status: 400 }
            );
        }

        if (!isSchedStatusReservable(effectiveSchedStatus)) {
            return NextResponse.json(
                { success: false, error: 'This schedule is not currently accepting reservations' },
                { status: 400 },
            );
        }

        const showScopeId = `${showId}:${schedId}`;
        const pauseState = await getQueuePauseState(showScopeId);
        if (pauseState) {
            return NextResponse.json(
                { success: false, error: pauseState.message, pauseReason: pauseState.reason },
                { status: 409 }
            );
        }

        // 3. Join the queue
        const userName =
            typeof displayName === "string" && displayName.trim().length > 0
                ? displayName.trim()
                : `Guest ${guestId.slice(0, 8)}`;

        const result = await joinQueue({
            showScopeId,
            userId: guestId,
            userName,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        const promotion = await promoteNextInQueue({ showScopeId });
        const promotedNow =
            promotion.promoted && promotion.activeSession?.ticketId === result.ticket?.ticketId;

        // 4. Return success with ticket data
        return NextResponse.json({
            success: true,
            ticket: result.ticket,
            rank: result.rank,
            estimatedWaitMinutes: result.estimatedWaitMinutes,
            showName: schedule.show.show_name,
            status: promotedNow ? 'active' : 'waiting',
            activeToken: promotedNow ? promotion.activeSession?.activeToken : undefined,
            expiresAt: promotedNow ? promotion.activeSession?.expiresAt : undefined,
        });
    } catch (error) {
        console.error('Error in /api/queue/join:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
