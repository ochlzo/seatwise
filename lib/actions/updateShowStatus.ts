'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { ShowStatus } from '@prisma/client';
import {
    assertShowCanMoveToRestrictedStatus,
    runShowQueueStatusTransition,
} from '@/lib/shows/showStatusLifecycle';

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

        await assertShowCanMoveToRestrictedStatus(prisma, showId, oldStatus, newStatus);

        // Update show status
        const updatedShow = await prisma.show.update({
            where: { show_id: showId },
            data: { show_status: newStatus },
            include: { scheds: true },
        });

        const queueResults = await runShowQueueStatusTransition({
            showId,
            oldStatus,
            newStatus,
            schedIds: updatedShow.scheds.map((sched) => sched.sched_id),
        });

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
                } catch {
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
