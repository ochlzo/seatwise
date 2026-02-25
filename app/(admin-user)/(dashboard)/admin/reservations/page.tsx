import { PageHeader } from "@/components/page-header";
import AdminShield from "@/components/AdminShield";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { ReservationsClient } from "./ReservationsClient";

export default async function AdminReservationsPage() {
    return (
        <>
            <PageHeader
                title="Reservations"
                rightSlot={
                    <>
                        <ThemeSwithcer />
                        <AdminShield />
                    </>
                }
            />
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <ReservationsClient />
            </div>
        </>
    );
}
