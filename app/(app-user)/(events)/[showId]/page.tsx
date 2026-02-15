import { getShowById } from "@/lib/db/Shows";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { ShowDetailPublic } from "@/components/show/ShowDetailPublic";
import StopLoadingOnMount from "@/components/stop-loading-on-mount";
import { ReserveNowButton } from "@/components/queue/ReserveNowButton";

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

  const isShowOpen = show.show_status === 'OPEN';

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
      sched_date: sched.sched_date.toISOString(),
      sched_start_time: sched.sched_start_time.toISOString(),
      sched_end_time: sched.sched_end_time.toISOString(),
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
              isShowOpen && serializedSchedules.length > 0 ? (
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
