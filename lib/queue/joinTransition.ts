const JOIN_TRANSITION_STORAGE_KEY = "seatwise:queue-join-transition";
const JOIN_TRANSITION_TTL_MS = 30_000;

type JoinTransitionState = {
  showScopeId: string;
  startedAt: number;
};

export const setJoinTransitionState = (showScopeId: string) => {
  if (typeof window === "undefined") return;

  const payload: JoinTransitionState = {
    showScopeId,
    startedAt: Date.now(),
  };

  window.sessionStorage.setItem(
    JOIN_TRANSITION_STORAGE_KEY,
    JSON.stringify(payload),
  );
};

export const getJoinTransitionState = (
  showScopeId: string,
): JoinTransitionState | null => {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(JOIN_TRANSITION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as JoinTransitionState;
    const isExpired = Date.now() - parsed.startedAt > JOIN_TRANSITION_TTL_MS;
    if (parsed.showScopeId !== showScopeId || isExpired) {
      window.sessionStorage.removeItem(JOIN_TRANSITION_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.sessionStorage.removeItem(JOIN_TRANSITION_STORAGE_KEY);
    return null;
  }
};

export const clearJoinTransitionState = (showScopeId?: string) => {
  if (typeof window === "undefined") return;

  if (!showScopeId) {
    window.sessionStorage.removeItem(JOIN_TRANSITION_STORAGE_KEY);
    return;
  }

  const current = getJoinTransitionState(showScopeId);
  if (current) {
    window.sessionStorage.removeItem(JOIN_TRANSITION_STORAGE_KEY);
  }
};
