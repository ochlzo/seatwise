import { redis } from '@/lib/clients/redis';
import { v4 as uuidv4 } from 'uuid';
import type { TicketData } from '@/lib/types/queue';

interface JoinQueueParams {
    showScopeId: string; // format: "showId:schedId"
    userId: string;
    userName: string;
}

interface JoinQueueResult {
    success: boolean;
    ticket?: TicketData;
    rank?: number;
    estimatedWaitMinutes?: number;
    error?: string;
}

const parseJson = <T>(value: unknown): T | null => {
    if (value == null) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }
    if (typeof value === 'object') {
        return value as T;
    }
    return null;
};

/**
 * Add a user to the queue for a specific show schedule
 */
export async function joinQueue({
    showScopeId,
    userId,
    userName,
}: JoinQueueParams): Promise<JoinQueueResult> {
    try {
        // 1. Check if user is already in queue
        const userTicketKey = `seatwise:user_ticket:${showScopeId}`;
        const existingTicketId = await redis.hget(userTicketKey, userId);
        const queueKey = `seatwise:queue:${showScopeId}`;

        if (existingTicketId) {
            const existingTicketKey = `seatwise:ticket:${showScopeId}:${existingTicketId}`;
            const existingActiveKey = `seatwise:active:${showScopeId}:${existingTicketId}`;
            const [existingRank, existingTicketRaw, existingActiveRaw] = await Promise.all([
                redis.zrank(queueKey, existingTicketId),
                redis.get(existingTicketKey),
                redis.get(existingActiveKey),
            ]);

            const existingActive = parseJson<{ expiresAt?: number }>(existingActiveRaw);
            const hasValidActive =
                !!existingActive?.expiresAt && existingActive.expiresAt > Date.now();
            const hasQueueEntry = existingRank !== null;
            const hasTicketData = !!parseJson<TicketData>(existingTicketRaw);

            if (hasValidActive || hasQueueEntry || hasTicketData) {
                return {
                    success: false,
                    error: 'You are already in the queue for this show',
                };
            }

            // Stale mapping: clear orphan references and allow a fresh join
            await redis.hdel(userTicketKey, userId);
            await redis.del(existingTicketKey, existingActiveKey);
        }

        // 2. Generate unique ticket ID
        const ticketId = uuidv4();
        const timestamp = Date.now();

        // 3. Create ticket data
        const ticket: TicketData = {
            ticketId,
            userId,
            sid: showScopeId,
            name: userName,
            joinedAt: timestamp,
        };

        // 4. Add to queue (sorted set by timestamp)
        await redis.zadd(queueKey, { score: timestamp, member: ticketId });

        // 5. Store ticket details
        const ticketKey = `seatwise:ticket:${showScopeId}:${ticketId}`;
        await redis.set(ticketKey, JSON.stringify(ticket));
        await redis.expire(ticketKey, 3600); // Expire after 1 hour

        // 6. Map user to ticket
        await redis.hset(userTicketKey, { [userId]: ticketId });

        // 7. Calculate rank (position in queue)
        const rank = await redis.zrank(queueKey, ticketId);
        const actualRank = rank !== null ? rank + 1 : 1; // Convert 0-based to 1-based

        // 8. Calculate estimated wait time
        const avgServiceMsKey = `seatwise:metrics:avg_service_ms:${showScopeId}`;
        const avgServiceMs = await redis.get<string | number>(avgServiceMsKey);
        const avgServiceTime =
            typeof avgServiceMs === 'number'
                ? avgServiceMs
                : avgServiceMs
                    ? parseInt(avgServiceMs, 10)
                    : 60000; // Default 60s

        const estimatedWaitMs = actualRank * avgServiceTime;
        const estimatedWaitMinutes = Math.ceil(estimatedWaitMs / 60000);

        console.log(`✅ User ${userId} joined queue ${showScopeId} at rank ${actualRank}`);

        return {
            success: true,
            ticket,
            rank: actualRank,
            estimatedWaitMinutes,
        };
    } catch (error) {
        console.error('❌ Failed to join queue:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to join queue',
        };
    }
}
