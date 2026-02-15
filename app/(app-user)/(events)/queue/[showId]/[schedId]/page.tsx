import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { QueueWaitingClient } from "./QueueWaitingClient";

export default async function QueueWaitingPage({
  params,
}: {
  params: Promise<{ showId: string; schedId: string }>;
}) {
  const { showId, schedId } = await params;

  return (
    <>
      <PageHeader title="Queue" rightSlot={<ThemeSwithcer />} />
      <div className="relative flex flex-1 flex-col bg-background">
        <QueueWaitingClient showId={showId} schedId={schedId} />
      </div>
    </>
  );
}

