import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";

export class AdminContextError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AdminContextError";
  }
}

export type AdminContext = {
  userId: string;
  firebaseUid: string;
  teamId: string | null;
  teamName: string | null;
  isSuperadmin: boolean;
};

export async function getCurrentAdminContext(): Promise<AdminContext> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    throw new AdminContextError("Unauthorized", 401);
  }

  let decodedUid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    decodedUid = decoded.uid;
  } catch {
    throw new AdminContextError("Unauthorized", 401);
  }

  const admin = await prisma.admin.findUnique({
    where: { firebase_uid: decodedUid },
    select: {
      user_id: true,
      firebase_uid: true,
      team_id: true,
      is_superadmin: true,
      team: { select: { name: true } },
    },
  });

  if (!admin) {
    throw new AdminContextError("Forbidden", 403);
  }

  return {
    userId: admin.user_id,
    firebaseUid: admin.firebase_uid,
    teamId: admin.team_id,
    teamName: admin.team?.name ?? null,
    isSuperadmin: admin.is_superadmin,
  };
}
