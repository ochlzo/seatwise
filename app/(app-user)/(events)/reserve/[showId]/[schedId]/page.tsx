import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { ReserveSeatClient } from "./ReserveSeatClient";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type SeatmapCategoryPayload = {
  category_id: string;
  name: string;
  color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
};

export default async function ReserveSeatPage({
  params,
}: {
  params: Promise<{ showId: string; schedId: string }>;
}) {
  const { showId, schedId } = await params;

  const schedule = await prisma.sched.findFirst({
    where: {
      sched_id: schedId,
      show_id: showId,
    },
    include: {
      show: {
        select: {
          show_name: true,
          seatmap_id: true,
        },
      },
      seatAssignments: {
        select: {
          seat_id: true,
          set: {
            select: {
              seat_category_id: true,
              seatCategory: {
                select: {
                  category_name: true,
                  color_code: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!schedule) {
    notFound();
  }

  const categoriesById = new Map<string, SeatmapCategoryPayload>();
  const seatCategoryAssignments: Record<string, string> = {};

  for (const assignment of schedule.seatAssignments) {
    const categoryId = assignment.set.seat_category_id;
    seatCategoryAssignments[assignment.seat_id] = categoryId;

    if (!categoriesById.has(categoryId)) {
      categoriesById.set(categoryId, {
        category_id: categoryId,
        name: assignment.set.seatCategory.category_name,
        color_code: assignment.set.seatCategory.color_code,
      });
    }
  }

  const seatmapCategories = Array.from(categoriesById.values());

  return (
    <>
      <PageHeader
        title="Reserve Seats"
        parentLabel={schedule.show.show_name}
        parentHref={`/${showId}`}
        rightSlot={<ThemeSwithcer />}
      />
      <div className="relative flex flex-1 flex-col bg-background">
        <ReserveSeatClient
          showId={showId}
          schedId={schedId}
          seatmapId={schedule.show.seatmap_id}
          seatmapCategories={seatmapCategories}
          seatCategoryAssignments={seatCategoryAssignments}
        />
      </div>
    </>
  );
}
