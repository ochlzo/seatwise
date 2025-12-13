type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type LambdaUser = {
  firebase_uid?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  role?: string | null;
  [key: string]: JsonValue | undefined;
};

const DEFAULT_USERS_LAMBDA_URL =
  "https://lzeuckvwxbs52kclyojrcw72wu0dwupo.lambda-url.ap-southeast-2.on.aws/";

function getUsersLambdaUrl(): string {
  const raw = process.env.USERS_LAMBDA_URL || DEFAULT_USERS_LAMBDA_URL;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function getUsersLambdaApiKey(): string {
  const key = process.env.USERS_LAMBDA_API_KEY;
  if (!key) throw new Error("Missing USERS_LAMBDA_API_KEY");
  return key;
}

function getUsersLambdaHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-api-key": getUsersLambdaApiKey(),
  };

  return extra ? { ...headers, ...extra } : headers;
}

async function readJsonSafely(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function withQuery(url: string, query: Record<string, string | undefined>) {
  const u = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.length > 0)
      u.searchParams.set(key, value);
  }
  return u.toString();
}

export async function lambdaGetUsers(): Promise<unknown> {
  const response = await fetch(getUsersLambdaUrl(), {
    method: "GET",
    headers: getUsersLambdaHeaders(),
    cache: "no-store",
  });

  const payload = await readJsonSafely(response);
  if (!response.ok) throw new Error("Users service request failed");
  return payload;
}

export async function lambdaGetUserByFirebaseUid(
  firebaseUid: string
): Promise<LambdaUser | null> {
  const url = withQuery(getUsersLambdaUrl(), { firebase_uid: firebaseUid });
  const response = await fetch(url, {
    method: "GET",
    headers: getUsersLambdaHeaders(),
    cache: "no-store",
  });

  const payload = await readJsonSafely(response);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Users service request failed");

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if ("user" in payload) return (payload as { user?: LambdaUser }).user ?? null;
    return payload as LambdaUser;
  }

  return null;
}

export async function lambdaUpsertUser(input: {
  firebase_uid: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username?: string | null;
}): Promise<LambdaUser> {
  const response = await fetch(getUsersLambdaUrl(), {
    method: "POST",
    headers: getUsersLambdaHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const payload = await readJsonSafely(response);
  if (!response.ok) throw new Error("Users service request failed");

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if ("user" in payload) return (payload as { user: LambdaUser }).user;
    return payload as LambdaUser;
  }

  return { firebase_uid: input.firebase_uid, email: input.email } as LambdaUser;
}