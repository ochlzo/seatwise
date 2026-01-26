import { getShowById } from "@/lib/db/Shows";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import AdminShield from "@/components/AdminShield";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { ShowDetailForm } from "./ShowDetailForm";

export default async function ShowIdPage({
    params,
}: {
    params: Promise<{ showId: string }>;
}) {
    const { showId } = await params;
    const show = await getShowById(showId);

    if (!show) {
        notFound();
    }

    return (
        <>
            <PageHeader
                title={show.show_name}
                rightSlot={
                    <>
                        <ThemeSwithcer />
                        <AdminShield />
                    </>
                }
            />
            <div className="relative overflow-hidden bg-background">
                {/* Ambient Background Layer */}
                {show.show_image_key && (
                    <>
                        <div
                            className="fixed inset-0 z-0 bg-cover bg-center origin-center blur-[160px] opacity-30 pointer-events-none"
                            style={{
                                backgroundImage: `url(${show.show_image_key})`,
                                backgroundPosition: "50% 35%",
                            }}
                        />
                        <div className="fixed inset-0 z-0 bg-background/40 backdrop-blur-3xl pointer-events-none" />
                    </>
                )}

                <div className="relative z-10 flex flex-col p-4 md:p-8 pt-0 max-w-7xl mx-auto w-full">
                    {/* Header with back breadcrumb is already handled by PageHeader, 
                        but we can add a specific title if needed */}
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold tracking-tight italic uppercase">
                            Edit Production
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Manage asset details, run-dates, and daily performance schedules.
                        </p>
                    </div>

                    <ShowDetailForm show={show} />
                </div>
            </div>
        </>
    );
}
