import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { ReserveSeatClient } from "./ReserveSeatClient";

export default async function ReserveSeatPage({
  params,
}: {
  params: Promise<{ showId: string; schedId: string }>;
}) {
  const { showId, schedId } = await params;

  return (
    <>
      <PageHeader title="Reserve Seat" rightSlot={<ThemeSwithcer />} />
      <div className="relative flex flex-1 flex-col bg-background">
        <ReserveSeatClient showId={showId} schedId={schedId} />
      </div>
    </>
  );
}
