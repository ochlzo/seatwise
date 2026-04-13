import { randomUUID } from "node:crypto";

import { redis } from "@/lib/clients/redis";

const SUBMISSION_LOCK_TTL_SECONDS = 15;

const getSubmissionLockKey = (showScopeId: string) =>
  `seatwise:reservation_submit_lock:${showScopeId}`;

export const acquireSubmissionLock = async (showScopeId: string) => {
  const token = randomUUID();
  const lockKey = getSubmissionLockKey(showScopeId);
  const result = await redis.set(lockKey, token, {
    nx: true,
    ex: SUBMISSION_LOCK_TTL_SECONDS,
  });

  return {
    acquired: !!result,
    token,
  };
};

export const releaseSubmissionLock = async ({
  showScopeId,
  token,
}: {
  showScopeId: string;
  token: string;
}) => {
  const lockKey = getSubmissionLockKey(showScopeId);
  const currentToken = (await redis.get(lockKey)) as string | null;
  if (currentToken === token) {
    await redis.del(lockKey);
  }
};
