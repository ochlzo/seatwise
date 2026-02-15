// Queue System Types

export interface TicketData {
    ticketId: string;
    userId: string;
    sid: string; // session ID
    name: string;
    joinedAt: number; // timestamp
}

export interface ActiveSession {
    userId: string;
    ticketId: string;
    activeToken: string;
    expiresAt: number;
    startedAt: number;
}

export interface QueueStatus {
    status: 'waiting' | 'active' | 'expired' | 'closed' | 'not_joined';
    ticketId?: string;
    rank?: number;
    name?: string;
    eta?: number; // estimated time in ms
}

export interface QueueMoveEvent {
    type: 'QUEUE_MOVE';
    departedRank: number;
    seq: number;
}

export interface QueueActiveEvent {
    type: 'ACTIVE';
    activeToken: string;
    expiresAt: number;
}

export interface QueueClosedEvent {
    type: 'QUEUE_CLOSED';
    message: string;
    timestamp: number;
}

export interface QueueSnapshotEvent {
    type: 'SNAPSHOT';
    seq: number;
    avgServiceMs: number;
    headCount: number;
}

export interface QueueSessionExpiredEvent {
    type: 'SESSION_EXPIRED';
    message: string;
    timestamp: number;
    disconnect: true;
}

export type QueueEvent =
    | QueueMoveEvent
    | QueueActiveEvent
    | QueueClosedEvent
    | QueueSnapshotEvent
    | QueueSessionExpiredEvent;
