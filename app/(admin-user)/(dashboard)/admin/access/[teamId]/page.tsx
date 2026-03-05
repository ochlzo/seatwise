import { PageHeader } from "@/components/page-header";
import AdminShield from "@/components/AdminShield";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { AdminAccessClient } from "../AdminAccessClient";

export default async function AdminAccessTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  return (
    <>
      <PageHeader
        title="Admin Access"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AdminAccessClient teamId={teamId} />
      </div>
    </>
  );
}

