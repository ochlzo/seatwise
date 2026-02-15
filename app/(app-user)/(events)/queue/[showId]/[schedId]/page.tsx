import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { QueueWaitingClient } from "./QueueWaitingClient";
import { getShowById } from "@/lib/db/Shows";
import { notFound } from "next/navigation";

export default async function QueueWaitingPage({
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
        title="Queue"
        parentLabel={show.show_name}
        parentHref={`/${showId}`}
        rightSlot={<ThemeSwithcer />}
      />
      <div className="relative flex flex-1 flex-col bg-background">
        <QueueWaitingClient showId={showId} schedId={schedId} />
      </div>
    </>
  );
}

