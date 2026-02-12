export type ResolveLoginCallbackOptions = {
  headerReturnTo?: string | null;
  defaultReturnTo?: string | null;
};

export function sanitizeInternalReturnPath(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  if (value === "/login") return null;
  return value;
}

export function resolveLoginCallbackUrl({
  headerReturnTo,
  defaultReturnTo,
}: ResolveLoginCallbackOptions) {
  const safeHeader = sanitizeInternalReturnPath(headerReturnTo);
  const safeDefault = sanitizeInternalReturnPath(defaultReturnTo);

  // If referer/header only gives root, prefer explicit protected route fallback.
  if (safeHeader === "/" && safeDefault && safeDefault !== "/") {
    return safeDefault;
  }

  return safeHeader ?? safeDefault ?? null;
}

