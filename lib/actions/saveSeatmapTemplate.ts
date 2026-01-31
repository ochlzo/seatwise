"use server";

import "server-only";
import type { Prisma } from "@prisma/client";
import type { SeatmapNode, SeatmapSeatNode } from "@/lib/seatmap/types";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

type SaveSeatmapPayload = {
  seatmap_name: string;
  seatmap_json: Prisma.InputJsonValue;
  seatmap_id?: string;
};

const extractSeatNodes = (seatmapJson: Prisma.InputJsonValue): SeatmapSeatNode[] => {
  if (!seatmapJson || typeof seatmapJson !== "object") return [];
  const nodes = (seatmapJson as { nodes?: Record<string, SeatmapNode> }).nodes;
  if (!nodes || typeof nodes !== "object") return [];
  return Object.values(nodes).filter(
    (node): node is SeatmapSeatNode =>
      Boolean(node) && typeof node === "object" && node.type === "seat",
  );
};

const buildSeatNumber = (seat: SeatmapSeatNode) => {
  const rowLabel = seat.rowLabel ?? "";
  const seatNumber =
    seat.seatNumber !== undefined && seat.seatNumber !== null
      ? String(seat.seatNumber)
      : "";
  const combined = `${rowLabel}${seatNumber}`.trim();
  return combined || seat.id;
};

async function assertAdmin() {
  const { adminAuth } = await import("@/lib/firebaseAdmin");
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
  const { prisma } = await import("@/lib/prisma");
  const fetchUser = async () => {
    return prisma.user.findUnique({
      where: { firebase_uid: decodedToken.uid },
    });
  };
  let user: Awaited<ReturnType<typeof fetchUser>> | null = null;
  try {
    user = await fetchUser();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("connection pool")) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      user = await fetchUser();
    } else {
      throw error;
    }
  }

  if (user?.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export async function saveSeatmapTemplateAction(payload: SaveSeatmapPayload) {
  try {
    await assertAdmin();
    const { prisma } = await import("@/lib/prisma");

    const { seatmap_name, seatmap_json, seatmap_id } = payload;

    // Check if updating an existing seatmap that has active seat assignments
    if (seatmap_id) {
      const conflictCheck = await prisma.seatAssignment.findFirst({
        where: {
          seat: {
            seatmap_id: seatmap_id,
          },
          sched: {
            show: {
              show_status: {
                in: ["OPEN", "ON_GOING", "UPCOMING"],
              },
            },
          },
        },
        include: {
          sched: {
            include: {
              show: {
                select: {
                  show_id: true,
                  show_name: true,
                  show_status: true,
                },
              },
            },
          },
        },
      });

      if (conflictCheck) {
        // Seatmap is in use by active shows - return conflict error
        return {
          success: false,
          error: "SEATMAP_IN_USE",
          conflictDetails: {
            showName: conflictCheck.sched.show.show_name,
            showStatus: conflictCheck.sched.show.show_status,
            message: `This seatmap is currently being used by "${conflictCheck.sched.show.show_name}" (${conflictCheck.sched.show.show_status}). You cannot modify it while it has active seat assignments.`,
          },
        };
      }
    }

    // 1. Pre-calculate seat data outside the transaction
    const seatNodes = extractSeatNodes(seatmap_json);
    const seatDataForCreate = seatNodes.map((seat) => ({
      seat_id: seat.id,
      seat_number: buildSeatNumber(seat),
      // seatmap_id will be assigned inside the transaction if creating new
    }));

    const created = await prisma.$transaction(
      async (tx) => {
        if (seatmap_id) {
          const updated = await tx.seatmap.update({
            where: { seatmap_id },
            data: {
              seatmap_name,
              seatmap_json,
            },
          });

          await tx.seat.deleteMany({ where: { seatmap_id } });

          if (seatDataForCreate.length > 0) {
            // Using createMany with chunks could be even safer if thousands of seats,
            // but for now, moving logic out + timeout is the main fix.
            await tx.seat.createMany({
              data: seatDataForCreate.map((s) => ({ ...s, seatmap_id })),
              skipDuplicates: true,
            });
          }

          return updated;
        }

        const seatmap = await tx.seatmap.create({
          data: {
            seatmap_name,
            seatmap_json,
          },
        });

        if (seatDataForCreate.length > 0) {
          await tx.seat.createMany({
            data: seatDataForCreate.map((s) => ({
              ...s,
              seatmap_id: seatmap.seatmap_id,
            })),
            skipDuplicates: true,
          });
        }

        return seatmap;
      },
      {
        maxWait: 5000,
        timeout: 20000,
      }
    );

    revalidatePath("/admin/templates");
    return { success: true, seatmapId: created.seatmap_id };
  } catch (error: unknown) {
    console.error("Error in saveSeatmapTemplateAction:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save seatmap";
    return { success: false, error: message };
  }
}
