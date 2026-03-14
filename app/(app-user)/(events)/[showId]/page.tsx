import { getShowById } from "@/lib/db/Shows";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { ShowDetailPublic } from "@/components/show/ShowDetailPublic";
import StopLoadingOnMount from "@/components/stop-loading-on-mount";
import { ReserveNowButton } from "@/components/queue/ReserveNowButton";

const MANILA_TZ = "Asia/Manila";

const formatManilaDateKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
};

const formatManilaTimeKey = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

export default async function ShowIdPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const show = await getShowById(showId);

  if (!show) {
    notFound();
  }

  const serializedShow = {
    ...show,
    scheds: show.scheds?.map((sched) => ({
      ...sched,
      seatAssignments: sched.seatAssignments?.map((assignment) => ({
        ...assignment,
        set: {
          ...assignment.set,
          seatCategory: {
            ...assignment.set.seatCategory,
            price: assignment.set.seatCategory.price.toString(),
          },
        },
      })),
    })),
    categorySets: show.categorySets?.map((categorySet) => ({
      ...categorySet,
      items: categorySet.items.map((item) => ({
        ...item,
        seatCategory: {
          ...item.seatCategory,
          price: item.seatCategory.price.toString(),
        },
      })),
    })),
  };

  const hasReservableSchedules = show.scheds.some(
    (sched) => sched.effective_status === "OPEN",
  );

  // Serialize schedules for client component (convert dates to strings and include categories)
  const serializedSchedules = show.scheds?.map((sched) => {
    // Extract unique categories from seat assignments
    const categories = sched.seatAssignments
      ?.map((assignment) => ({
        name: assignment.set.seatCategory.category_name,
        price: assignment.set.seatCategory.price.toString(),
      }))
      // Remove duplicates by category name
      .filter((cat, index, self) =>
        index === self.findIndex((c) => c.name === cat.name)
      ) || [];

    return {
      sched_id: sched.sched_id || '',
      sched_date: formatManilaDateKey(sched.sched_date),
      sched_start_time: formatManilaTimeKey(sched.sched_start_time),
      sched_end_time: formatManilaTimeKey(sched.sched_end_time),
      effective_status: sched.effective_status,
      categories,
    };
  }) || [];

  return (
    <>
      <StopLoadingOnMount />
      <PageHeader
        title={show.show_name}
        className="z-20"
        rightSlot={<ThemeSwithcer />}
      />
      <div className="relative flex flex-1 flex-col bg-background">
        <div className="relative z-10 flex flex-1 flex-col p-4 md:p-8 pt-0 max-w-7xl mx-auto w-full">
          <ShowDetailPublic
            show={serializedShow}
            reserveButton={
              hasReservableSchedules && serializedSchedules.length > 0 ? (
                <ReserveNowButton
                  showId={show.show_id}
                  showName={show.show_name}
                  schedules={serializedSchedules}
                />
              ) : undefined
            }
          />
        </div>
      </div>
    </>
  );
}
