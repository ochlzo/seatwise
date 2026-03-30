export const getQueueKey = (showScopeId: string) => `seatwise:queue:${showScopeId}`;

export const getActiveSessionKey = (showScopeId: string, ticketId: string) =>
  `seatwise:active:${showScopeId}:${ticketId}`;

export const getActiveSessionPointerKey = (showScopeId: string) =>
  `seatwise:active_pointer:${showScopeId}`;

export const getTicketKey = (showScopeId: string, ticketId: string) =>
  `seatwise:ticket:${showScopeId}:${ticketId}`;

export const getUserTicketKey = (showScopeId: string) =>
  `seatwise:user_ticket:${showScopeId}`;
