import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { ReserveSeatClient } from "./ReserveSeatClient";
import { getShowById } from "@/lib/db/Shows";
import { notFound } from "next/navigation";

export default async function ReserveSeatPage({
  params,
}: {
  params: Promise<{ showId: string; schedId: string }>;
}) {
  const { showId, schedId } = await params;
  const show = await getShowById(showId);

  if (!show) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Reserve Seats"
        parentLabel={show.show_name}
        parentHref={`/${showId}`}
        rightSlot={<ThemeSwithcer />}
      />
      <div className="relative flex flex-1 flex-col bg-background">
        <ReserveSeatClient showId={showId} schedId={schedId} />
      </div>
    </>
  );
}
