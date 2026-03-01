export const GUEST_ID_STORAGE_KEY = "seatwise:guest_id";

export const createGuestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const getOrCreateGuestId = () => {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const next = createGuestId();
  window.localStorage.setItem(GUEST_ID_STORAGE_KEY, next);
  return next;
};
