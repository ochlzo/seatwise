import AdminShield from "@/components/AdminShield";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { getTicketTemplates } from "@/lib/db/TicketTemplates";

import { TicketTemplateTable } from "./TicketTemplateTable";

export default async function TicketTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const adminContext = await getCurrentAdminContext();
  const ticketTemplates = await getTicketTemplates({
    adminScope: {
      teamId: adminContext.teamId,
      isSuperadmin: adminContext.isSuperadmin,
    },
    query: params.q,
    sort: params.sort,
  });

  return (
    <>
      <PageHeader
        title="Ticket Templates"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0 md:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold md:text-xl">Ticket Template Library</h2>
          <p className="text-sm text-muted-foreground">
            Manage reusable ticket layouts and open them in the ticket designer.
          </p>
        </div>
        <TicketTemplateTable ticketTemplates={ticketTemplates} />
      </div>
    </>
  );
}
