import assert from "node:assert/strict";
import { getProceedWindowDeadline, renewProceedWindowSession } from "./proceedWindow.ts";

const originalSession = {
  userId: "user_123",
  ticketId: "ticket_abc",
  activeToken: "token_xyz",
  expiresAt: 1_700_000_000_000,
  startedAt: 1_699_999_940_000,
  mode: "online" as const,
};

const renewed = renewProceedWindowSession(originalSession, 1_700_000_060_000);

assert.equal(renewed.userId, originalSession.userId);
assert.equal(renewed.ticketId, originalSession.ticketId);
assert.equal(renewed.activeToken, originalSession.activeToken);
assert.equal(renewed.startedAt, originalSession.startedAt);
assert.equal(renewed.mode, originalSession.mode);
assert.equal(renewed.expiresAt, 1_700_000_120_000);

assert.equal(getProceedWindowDeadline(1_700_000_060_000), 1_700_000_120_000);
