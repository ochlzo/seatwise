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
  avatarKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Helper to determine if a user account was just created.
 * Compares createdAt and updatedAt timestamps.
 * Optionally checks if they signed up using a specific provider (e.g., 'google.com').
 */
export function isNewUser(user: DbUser, provider?: string): boolean {
  const isCreatedNow = user.createdAt.getTime() === user.updatedAt.getTime();

  if (provider === "google.com") {
    return isCreatedNow && provider === "google.com";
  }

  return isCreatedNow;
}

const userSelect = {
  firebase_uid: true,
  email: true,
  first_name: true,
  last_name: true,
  username: true,
  role: true,
  status: true,
  avatar_key: true,
  createdAt: true,
  updatedAt: true,
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
    avatarKey: user.avatar_key ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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

  const normalizedUsername = normalizeString(input.username);
  const derivedUsername =
    normalizedUsername ??
    email.split("@")[0] ??
    normalizeString(input.firebase_uid);
  if (!derivedUsername) {
    throw new Error("Missing username");
  }

  const updateData = {
    email,
    first_name: normalizeString(input.first_name) ?? undefined,
    last_name: normalizeString(input.last_name) ?? undefined,
    username: normalizedUsername ?? undefined,
  };

  const existingByUid = await prisma.user.findUnique({
    where: { firebase_uid: input.firebase_uid },
    select: userSelect,
  });

  if (existingByUid) {
    const updated = await prisma.user.update({
      where: { firebase_uid: input.firebase_uid },
      data: updateData,
      select: userSelect,
    });
    return toDbUser(updated);
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: userSelect,
  });

  if (existingByEmail) {
    const updated = await prisma.user.update({
      where: { email },
      data: {
        ...updateData,
        firebase_uid: input.firebase_uid,
      },
      select: userSelect,
    });
    return toDbUser(updated);
  }

  const user = await prisma.user.create({
    data: {
      firebase_uid: input.firebase_uid,
      email,
      username: derivedUsername,
      first_name: normalizeString(input.first_name) ?? "",
      last_name: normalizeString(input.last_name) ?? "",
      status: "ACTIVE",
      role: "USER",
    },
    select: userSelect,
  });

  return toDbUser(user);
}

export async function updateUserAvatar(
  firebaseUid: string,
  avatarKey: string
): Promise<DbUser> {
  const updated = await prisma.user.update({
    where: { firebase_uid: firebaseUid },
    data: { avatar_key: avatarKey },
    select: userSelect,
  });
  return toDbUser(updated);
}
