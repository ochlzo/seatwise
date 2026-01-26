import { PageHeader } from "@/components/page-header";
import AdminShield from "@/components/AdminShield";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { getSeatmaps } from "@/lib/db/Seatmaps";
import { SeatmapTable } from "./SeatmapTable";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const seatmaps = await getSeatmaps({ query: params.q, sort: params.sort });

  return (
    <>
      <PageHeader
        title="Seatmap Templates"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 pt-0">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg md:text-xl font-semibold">Seatmap Library</h2>
          <p className="text-muted-foreground text-sm">
            Manage templates, schedules, and event associations.
          </p>
        </div>
        <SeatmapTable seatmaps={seatmaps as any} />
      </div>
    </>
  );
}
