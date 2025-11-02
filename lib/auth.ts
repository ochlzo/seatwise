export type LocalUser = {
  userId: string;
  name: string;
};

const USER_ID_KEY = "userId";
const USER_NAME_KEY = "name";
const SESSION_ID_KEY = "sessionId";

export function getStoredUser(): LocalUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const userId = window.localStorage.getItem(USER_ID_KEY);
  const name = window.localStorage.getItem(USER_NAME_KEY);

  if (!userId || !name) {
    return null;
  }

  return { userId, name };
}

export function setStoredUser(user: LocalUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(USER_ID_KEY, user.userId);
  window.localStorage.setItem(USER_NAME_KEY, user.name);
}

export function clearStoredUser() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(USER_ID_KEY);
  window.localStorage.removeItem(USER_NAME_KEY);
}

export function ensureSessionId(): string {
  if (typeof window === "undefined") {
    throw new Error("Session storage is not available on the server.");
  }

  let sessionId = window.sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = window.crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  return sessionId;
}

export function getSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(SESSION_ID_KEY);
}
