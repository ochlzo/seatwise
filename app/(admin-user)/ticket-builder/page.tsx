import { TicketBuilderPageClient } from "@/components/ticket-template/TicketBuilderPageClient";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";

export const dynamic = "force-dynamic";

export default async function TicketBuilderPage() {
  await getCurrentAdminContext();

  return <TicketBuilderPageClient />;
}
