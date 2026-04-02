import "server-only";

import crypto from "node:crypto";
import { redis } from "@/lib/clients/redis";
import {
  reservationEmailOtpLockKey,
  reservationEmailOtpArtifactKeys,
  reservationEmailOtpSessionKey,
  reservationEmailOtpStateKey,
  type ReservationEmailOtpSession,
  type ReservationEmailOtpState,
} from "./reservationEmailOtp";

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

export const getReservationEmailOtpSession = async (
  showScopeId: string,
  ticketId: string,
) => {
  const raw = await redis.get(reservationEmailOtpSessionKey(showScopeId, ticketId));
  return parseJson<ReservationEmailOtpSession>(raw);
};

export const setReservationEmailOtpSession = async (
  session: ReservationEmailOtpSession,
) => {
  const ttlSeconds = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000));
  await redis.set(
    reservationEmailOtpSessionKey(session.showScopeId, session.ticketId),
    JSON.stringify(session),
    { ex: ttlSeconds },
  );
};

export const clearReservationEmailOtpSession = async (
  showScopeId: string,
  ticketId: string,
) => {
  await redis.del(reservationEmailOtpSessionKey(showScopeId, ticketId));
};

export const getReservationEmailOtpState = async (
  showScopeId: string,
  ticketId: string,
) => {
  const raw = await redis.get(reservationEmailOtpStateKey(showScopeId, ticketId));
  return parseJson<ReservationEmailOtpState>(raw);
};

export const setReservationEmailOtpState = async (
  showScopeId: string,
  ticketId: string,
  state: ReservationEmailOtpState,
) => {
  const ttlSeconds = Math.max(1, Math.floor((state.expiresAt - Date.now()) / 1000));
  await redis.set(
    reservationEmailOtpStateKey(showScopeId, ticketId),
    JSON.stringify(state),
    { ex: ttlSeconds },
  );
};

export const clearReservationEmailOtpState = async (
  showScopeId: string,
  ticketId: string,
) => {
  await redis.del(reservationEmailOtpStateKey(showScopeId, ticketId));
};

export const clearReservationEmailOtpArtifacts = async (
  showScopeId: string,
  ticketId: string,
) => {
  await redis.del(...reservationEmailOtpArtifactKeys(showScopeId, ticketId));
};

export const withReservationEmailOtpLock = async <T>(
  showScopeId: string,
  ticketId: string,
  fn: () => Promise<T>,
): Promise<T | null> => {
  const lockId = crypto.randomUUID();
  const key = reservationEmailOtpLockKey(showScopeId, ticketId);
  const acquired = await redis.set(key, lockId, { nx: true, ex: 30 });

  if (!acquired) {
    return null;
  }

  try {
    return await fn();
  } finally {
    try {
      const currentLock = await redis.get(key);
      if (typeof currentLock === "string" && currentLock === lockId) {
        await redis.del(key);
      }
    } catch {
      // Best-effort lock release; the key is short-lived.
    }
  }
};
