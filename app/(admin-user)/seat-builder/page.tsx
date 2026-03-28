import { SeatBuilderPageClient } from "@/components/seatmap/SeatBuilderPageClient";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";

export const dynamic = "force-dynamic";

export default async function SeatBuilderPage() {
  await getCurrentAdminContext();

  return <SeatBuilderPageClient />;
}

