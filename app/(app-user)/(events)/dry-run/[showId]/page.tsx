import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import StopLoadingOnMount from "@/components/stop-loading-on-mount";
import { ShowDetailPublic } from "@/components/show/ShowDetailPublic";
import { ReserveNowButton } from "@/components/queue/ReserveNowButton";
import { getShowById } from "@/lib/db/Shows";
import {
  hasSelectableSchedules,
  serializeSchedulesForPicker,
} from "@/lib/shows/schedulePicker";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

export default async function DryRunShowPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const show = await getShowById(showId);

  if (!show || show.show_status !== "DRY_RUN") {
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

  const serializedSchedules = serializeSchedulesForPicker(show.scheds);
  const hasReservableSchedules = hasSelectableSchedules(serializedSchedules);

  return (
    <>
      <StopLoadingOnMount />
      <PageHeader
        title={`${show.show_name} (Dry Run)`}
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
                  accessMode="dry-run"
                />
              ) : undefined
            }
          />
        </div>
      </div>
    </>
  );
}
