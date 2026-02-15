import { redis } from "@/lib/clients/redis";
import type { ActiveSession } from "@/lib/types/queue";
import { expireQueueSession } from "@/lib/queue/queueLifecycle";

export interface ValidateActiveSessionParams {
  showScopeId: string;
  ticketId: string;
  userId: string;
  activeToken: string;
}

export interface ValidateActiveSessionResult {
  valid: boolean;
  reason?: "missing" | "expired" | "ticket_mismatch" | "token_mismatch";
  session?: ActiveSession;
}

const parseActiveSession = (value: unknown): ActiveSession | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as ActiveSession;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as ActiveSession;
  }
  return null;
};

export async function validateActiveSession({
  showScopeId,
  ticketId,
  userId,
  activeToken,
}: ValidateActiveSessionParams): Promise<ValidateActiveSessionResult> {
  const activeKey = `seatwise:active:${showScopeId}:${ticketId}`;
  const activeJson = await redis.get(activeKey);
  const session = parseActiveSession(activeJson);

  if (!session) {
    const userTicketKey = `seatwise:user_ticket:${showScopeId}`;
    const mappedTicketId = (await redis.hget(userTicketKey, userId)) as string | null;

    if (mappedTicketId === ticketId) {
      const queueKey = `seatwise:queue:${showScopeId}`;
      const rank = await redis.zrank(queueKey, ticketId);
      if (rank === null) {
        await expireQueueSession({
          showScopeId,
          ticketId,
          userId,
        });
      }
    }

    return { valid: false, reason: "missing" };
  }

  if (session.userId !== userId || session.ticketId !== ticketId) {
    return { valid: false, reason: "ticket_mismatch", session };
  }

  if (session.expiresAt <= Date.now()) {
    await expireQueueSession({
      showScopeId,
      ticketId: session.ticketId || ticketId,
      userId: session.userId || userId,
    });

    return { valid: false, reason: "expired", session };
  }

  if (session.activeToken !== activeToken) {
    return { valid: false, reason: "token_mismatch", session };
  }

  return { valid: true, session };
}
