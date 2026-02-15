import { redis } from '@/lib/clients/redis';
import { ably } from '@/lib/clients/ably';
import type { QueueClosedEvent } from '@/lib/types/queue';

/**
 * Close queue and notify all users
 * Called when show status changes to CLOSED or CANCELLED
 */
export async function closeQueueChannel(
    showScopeId: string,
    reason: 'closed' | 'cancelled' = 'closed'
) {
    try {
        const queueKey = `seatwise:queue:${showScopeId}`;

        // Get all users currently in queue
        const ticketIds = (await redis.zrange(queueKey, 0, -1)) as string[];

        // Notify all users via public channel
        const channel = ably.channels.get(`seatwise:${showScopeId}:public`);

        const message: QueueClosedEvent = {
            type: 'QUEUE_CLOSED',
            message:
                reason === 'cancelled'
                    ? 'This show has been cancelled. Queue is now closed.'
                    : 'This show is no longer accepting reservations. Queue is now closed.',
            timestamp: Date.now(),
        };

        await channel.publish('queue-event', message);

        // Also notify each user on their private channel
        for (const ticketId of ticketIds) {
            const privateChannel = ably.channels.get(
                `seatwise:${showScopeId}:private:${ticketId}`
            );
            await privateChannel.publish('queue-event', message);
        }

        // Clean up Redis keys
        const keysToDelete = [
            queueKey,
            `seatwise:seq:${showScopeId}`,
            `seatwise:metrics:avg_service_ms:${showScopeId}`,
            `seatwise:user_ticket:${showScopeId}`,
        ];

        // Delete ticket data for all users
        const ticketKeys = ticketIds.map(
            (ticketId) => `seatwise:ticket:${showScopeId}:${ticketId}`
        );
        keysToDelete.push(...ticketKeys);

        // Delete all keys
        if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete);
        }

        console.log(
            `✅ Queue closed for ${showScopeId} (${reason}). Notified ${ticketIds.length} users.`
        );

        return {
            success: true,
            showScopeId,
            notifiedUsers: ticketIds.length,
            message: `Queue closed successfully (${reason})`,
        };
    } catch (error) {
        console.error(`❌ Failed to close queue for ${showScopeId}:`, error);
        throw new Error(
            `Failed to close queue: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Pause queue (for POSTPONED status)
 * Keeps data but prevents new joins
 */
export async function pauseQueueChannel(showScopeId: string) {
    try {
        // Set a flag to indicate queue is paused
        const pausedKey = `seatwise:paused:${showScopeId}`;
        await redis.set(pausedKey, 1);

        // Notify all users
        const channel = ably.channels.get(`seatwise:${showScopeId}:public`);
        await channel.publish('queue-event', {
            type: 'QUEUE_CLOSED',
            message: 'This show has been postponed. Queue is temporarily paused.',
            timestamp: Date.now(),
        });

        console.log(`⏸️ Queue paused for ${showScopeId}`);

        return {
            success: true,
            showScopeId,
            message: 'Queue paused successfully',
        };
    } catch (error) {
        console.error(`❌ Failed to pause queue for ${showScopeId}:`, error);
        throw error;
    }
}

/**
 * Resume queue (after POSTPONED → OPEN)
 */
export async function resumeQueueChannel(showScopeId: string) {
    try {
        // Remove paused flag
        const pausedKey = `seatwise:paused:${showScopeId}`;
        await redis.del(pausedKey);

        // Notify all users
        const channel = ably.channels.get(`seatwise:${showScopeId}:public`);
        await channel.publish('queue-event', {
            type: 'SNAPSHOT',
            message: 'Queue has resumed. You can now join.',
            timestamp: Date.now(),
        });

        console.log(`▶️ Queue resumed for ${showScopeId}`);

        return {
            success: true,
            showScopeId,
            message: 'Queue resumed successfully',
        };
    } catch (error) {
        console.error(`❌ Failed to resume queue for ${showScopeId}:`, error);
        throw error;
    }
}
