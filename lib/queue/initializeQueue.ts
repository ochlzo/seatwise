import { redis } from '@/lib/clients/redis';

/**
 * Initialize queue for a specific show/schedule
 * Called when show status changes to OPEN
 */
export async function initializeQueueChannel(showScopeId: string) {
    try {
        // Initialize sequence number for broadcast events
        const seqKey = `seatwise:seq:${showScopeId}`;
        await redis.set(seqKey, 0);

        // Initialize average service time (default: 60 seconds)
        const metricsKey = `seatwise:metrics:avg_service_ms:${showScopeId}`;
        await redis.set(metricsKey, 60000);

        // Note: Queue ZSET and other keys are created on-demand when users join
        // Ably channels are also created on-demand when first user subscribes

        console.log(`✅ Queue initialized for ${showScopeId}`);

        return {
            success: true,
            showScopeId,
            message: 'Queue channel initialized successfully',
        };
    } catch (error) {
        console.error(`❌ Failed to initialize queue for ${showScopeId}:`, error);
        throw new Error(`Failed to initialize queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Check if queue is initialized for a show/schedule
 */
export async function isQueueInitialized(showScopeId: string): Promise<boolean> {
    try {
        const seqKey = `seatwise:seq:${showScopeId}`;
        const seq = await redis.get(seqKey);
        return seq !== null;
    } catch (error) {
        console.error(`Failed to check queue status for ${showScopeId}:`, error);
        return false;
    }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(showScopeId: string) {
    try {
        const queueKey = `seatwise:queue:${showScopeId}`;
        const metricsKey = `seatwise:metrics:avg_service_ms:${showScopeId}`;
        const seqKey = `seatwise:seq:${showScopeId}`;

        const [queueSize, avgServiceMs, seq] = await Promise.all([
            redis.zcard(queueKey),
            redis.get<number>(metricsKey),
            redis.get<number>(seqKey),
        ]);

        return {
            showScopeId,
            queueSize: queueSize || 0,
            avgServiceMs: avgServiceMs || 60000,
            seq: seq || 0,
            estimatedWaitTime: (queueSize || 0) * (avgServiceMs || 60000),
        };
    } catch (error) {
        console.error(`Failed to get queue stats for ${showScopeId}:`, error);
        throw error;
    }
}
