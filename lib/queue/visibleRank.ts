import { redis } from "../clients/redis.ts";
import type { TicketData } from "../types/queue.ts";
import { getActiveSessionKey, getQueueKey, getTicketKey, getUserTicketKey } from "./queueKeys.ts";
import { computeVisibleQueueRank, type VisibleQueueRankEntry } from "./computeVisibleQueueRank.ts";

const parseJson = <T>(value: unknown): T | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return null;
};

export async function resolveVisibleQueueRank({
  showScopeId,
  ticketId,
}: {
  showScopeId: string;
  ticketId: string;
}) {
  const queueKey = getQueueKey(showScopeId);
  const rawRank = await redis.zrank(queueKey, ticketId);

  if (rawRank === null) {
    return null;
  }

  const userTicketKey = getUserTicketKey(showScopeId);
  const candidateTicketIds = (await redis.zrange(queueKey, 0, rawRank)) as string[];
  const entries: VisibleQueueRankEntry[] = [];

  for (const candidateTicketId of candidateTicketIds) {
    const ticketKey = getTicketKey(showScopeId, candidateTicketId);
    const ticket = parseJson<TicketData>(await redis.get(ticketKey));
    const mappedTicketId = ticket?.userId
      ? ((await redis.hget(userTicketKey, ticket.userId)) as string | null)
      : null;
    const hasCurrentUserMapping = !!ticket?.userId && mappedTicketId === candidateTicketId;

    if (!ticket || !hasCurrentUserMapping) {
      const activeKey = getActiveSessionKey(showScopeId, candidateTicketId);
      await redis.zrem(queueKey, candidateTicketId);
      await redis.del(ticketKey, activeKey);
      if (ticket?.userId && mappedTicketId === candidateTicketId) {
        await redis.hdel(userTicketKey, ticket.userId);
      }
    }

    entries.push({
      ticketId: candidateTicketId,
      isTarget: candidateTicketId === ticketId,
      hasTicketData: !!ticket,
      hasCurrentUserMapping,
    });
  }

  return computeVisibleQueueRank(entries);
}
