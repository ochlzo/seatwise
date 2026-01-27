"use server";

import "server-only";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ShowStatus } from "@prisma/client";

type CreateShowPayload = {
  show_name: string;
  show_description: string;
  venue: string;
  address: string;
  show_status: ShowStatus;
  show_start_date: string | Date;
  show_end_date: string | Date;
  show_image_key?: string;
  image_base64?: string;
  seatmap_id?: string | null;
  scheds?: Array<{
    sched_date: string;
    sched_start_time: string;
    sched_end_time: string;
  }>;
};

const toDateOnly = (value: string | Date) => {
  // Handle string input (YYYY-MM-DD) by forcing UTC midnight
  if (typeof value === "string") {
    return new Date(`${value}T00:00:00Z`);
  }
  // For Date objects, return as-is (assuming already handled) or strip time if needed
  // But typically input is string from form.
  return value;
};

const toTime = (timeValue: string) => {
  // Force UTC parsing to preserve the exact HH:mm entered by the user
  // This prevents server timezone offsets from shifting the stored time
  return new Date(`1970-01-01T${timeValue}:00Z`);
};

export async function createShowAction(data: CreateShowPayload) {
  try {
    const { adminAuth } = await import("@/lib/firebaseAdmin");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      throw new Error("Unauthorized");
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const user = await prisma.user.findUnique({
      where: { firebase_uid: decodedToken.uid },
    });

    if (user?.role !== "ADMIN") {
      throw new Error("Forbidden");
    }

    const {
      show_name,
      show_description,
      venue,
      address,
      show_status,
      show_start_date,
      show_end_date,
      show_image_key,
      image_base64,
      seatmap_id,
      scheds = [],
    } = data;

    let finalImageUrl = show_image_key;
    if (image_base64) {
      const cloudinary = (await import("@/lib/cloudinary")).default;
      const uploadResponse = await cloudinary.uploader.upload(image_base64, {
        folder: "seatwise/show_thumbnails",
        resource_type: "image",
      });
      finalImageUrl = uploadResponse.secure_url;
    }

    const show = await prisma.$transaction(async (tx) => {
      const created = await tx.show.create({
        data: {
          show_name,
          show_description,
          venue,
          address,
          show_status,
          show_start_date: toDateOnly(show_start_date),
          show_end_date: toDateOnly(show_end_date),
          show_image_key: finalImageUrl,
          seatmap_id: seatmap_id || null,
        },
      });

      if (scheds.length > 0) {
        await tx.sched.createMany({
          data: scheds.map((s) => ({
            show_id: created.show_id,
            sched_date: toDateOnly(s.sched_date),
            sched_start_time: toTime(s.sched_start_time),
            sched_end_time: toTime(s.sched_end_time),
          })),
        });
      }

      return created;
    });

    revalidatePath("/admin/shows");

    return { success: true, showId: show.show_id };
  } catch (error: unknown) {
    console.error("Error in createShowAction:", error);
    const message = error instanceof Error ? error.message : "Failed to create show";
    return { success: false, error: message };
  }
}
