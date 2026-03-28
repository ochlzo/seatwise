import { TicketBuilderPageClient } from "@/components/ticket-template/TicketBuilderPageClient";
import {
  AdminContextError,
  getCurrentAdminContext,
} from "@/lib/auth/adminContext";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TicketBuilderPage() {
  try {
    await getCurrentAdminContext();
  } catch (error) {
    if (error instanceof AdminContextError) {
      if (error.status === 401 || error.status === 403) {
        notFound();
      }
    }

    throw error;
  }

  return <TicketBuilderPageClient />;
}
