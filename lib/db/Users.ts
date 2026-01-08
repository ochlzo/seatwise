import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type DbUser = {
  firebase_uid: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: string | null;
  status: string | null;
};

const userSelect = {
  firebase_uid: true,
  email: true,
  first_name: true,
  last_name: true,
  username: true,
  role: true,
  status: true,
} as const;

type UserRecord = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toDbUser(user: UserRecord): DbUser {
  return {
    firebase_uid: user.firebase_uid,
    email: user.email ?? null,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    username: user.username ?? null,
    role: user.role ?? null,
    status: user.status ?? null,
  };
}

export async function getUsers(): Promise<DbUser[]> {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });

  return users.map(toDbUser);
}

export async function getUserByFirebaseUid(
  firebaseUid: string
): Promise<DbUser | null> {
  const user = await prisma.user.findUnique({
    where: { firebase_uid: firebaseUid },
    select: userSelect,
  });

  return user ? toDbUser(user) : null;
}

export async function upsertUser(input: {
  firebase_uid: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username?: string | null;
}): Promise<DbUser> {
  const email = normalizeString(input.email);
  if (!email) {
    throw new Error("Missing email");
  }

  const username = normalizeString(input.username);

  const createFirstName = normalizeString(input.first_name) ?? "";
  const createLastName = normalizeString(input.last_name) ?? "";

  const user = await prisma.user.upsert({
    where: { firebase_uid: input.firebase_uid },
    update: {
      email,
      first_name: normalizeString(input.first_name) ?? undefined,
      last_name: normalizeString(input.last_name) ?? undefined,
      username: normalizeString(input.username) ?? undefined,
    },
    create: {
      firebase_uid: input.firebase_uid,
      email,
      username: username as any,
      first_name: createFirstName,
      last_name: createLastName,
      status: "ACTIVE",
      role: "USER",
    },
    select: userSelect,
  });

  return toDbUser(user);
}
