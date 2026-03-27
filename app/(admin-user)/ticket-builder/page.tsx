import { ComingSoonClient } from "@/components/coming-soon-client";
import { PageHeader } from "@/components/page-header";
import AdminShield from "@/components/AdminShield";
import { ThemeSwithcer } from "@/components/theme-swithcer";

export default function TicketBuilderPage() {
  return (
    <>
      <PageHeader
        title="Ticket Designer"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <ComingSoonClient />
    </>
  );
}
