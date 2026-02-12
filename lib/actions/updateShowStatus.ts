'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { initializeQueueChannel } from '@/lib/queue/initializeQueue';
import { closeQueueChannel, pauseQueueChannel } from '@/lib/queue/closeQueue';
import type { ShowStatus } from '@prisma/client';

/**
 * Update show status and manage queue lifecycle
 */
export async function updateShowStatus(showId: string, newStatus: ShowStatus) {
    try {
        // Fetch show with schedules
        const show = await prisma.show.findUnique({
            where: { show_id: showId },
            include: { scheds: true },
        });

        if (!show) {
            throw new Error('Show not found');
        }

        const oldStatus = show.show_status;

        // Update show status
        const updatedShow = await prisma.show.update({
            where: { show_id: showId },
            data: { show_status: newStatus },
            include: { scheds: true },
        });

        // Handle queue lifecycle based on status transition
        const queueResults = [];

        for (const sched of updatedShow.scheds) {
            const showScopeId = `${showId}:${sched.sched_id}`;

            try {
                // Initialize queue when status changes to OPEN
                if (newStatus === 'OPEN' && oldStatus !== 'OPEN') {
                    const result = await initializeQueueChannel(showScopeId);
                    queueResults.push(result);
                }

                // Close queue when status changes to CLOSED or CANCELLED
                else if (
                    (newStatus === 'CLOSED' || newStatus === 'CANCELLED') &&
                    (oldStatus === 'OPEN' || oldStatus === 'ON_GOING')
                ) {
                    const result = await closeQueueChannel(
                        showScopeId,
                        newStatus === 'CANCELLED' ? 'cancelled' : 'closed'
                    );
                    queueResults.push(result);
                }

                // Pause queue when status changes to POSTPONED
                else if (newStatus === 'POSTPONED' && oldStatus === 'OPEN') {
                    const result = await pauseQueueChannel(showScopeId);
                    queueResults.push(result);
                }
            } catch (queueError) {
                console.error(
                    `Queue operation failed for ${showScopeId}:`,
                    queueError
                );
                // Continue with other schedules even if one fails
            }
        }

        // Revalidate relevant paths
        revalidatePath('/dashboard/shows');
        revalidatePath(`/dashboard/shows/${showId}`);

        return {
            success: true,
            show: updatedShow,
            queueResults,
            message: `Show status updated to ${newStatus}`,
        };
    } catch (error) {
        console.error('Failed to update show status:', error);
        throw new Error(
            `Failed to update show status: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Get queue status for all schedules of a show
 */
export async function getShowQueueStatus(showId: string) {
    try {
        const show = await prisma.show.findUnique({
            where: { show_id: showId },
            include: { scheds: true },
        });

        if (!show) {
            throw new Error('Show not found');
        }

        const { getQueueStats } = await import('@/lib/queue/initializeQueue');

        const queueStatuses = await Promise.all(
            show.scheds.map(async (sched) => {
                const showScopeId = `${showId}:${sched.sched_id}`;
                try {
                    const stats = await getQueueStats(showScopeId);
                    return {
                        schedId: sched.sched_id,
                        schedDate: sched.sched_date,
                        ...stats,
                    };
                } catch (error) {
                    return {
                        schedId: sched.sched_id,
                        schedDate: sched.sched_date,
                        error: 'Failed to fetch queue stats',
                    };
                }
            })
        );

        return {
            success: true,
            showId,
            showStatus: show.show_status,
            queueStatuses,
        };
    } catch (error) {
        console.error('Failed to get show queue status:', error);
        throw error;
    }
}
