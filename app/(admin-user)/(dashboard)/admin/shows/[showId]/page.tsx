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

    // Serialize the show data to convert Decimal types to strings
    const serializedShow = {
        ...show,
        scheds: show.scheds?.map((sched) => ({
            ...sched,
            seatAssignments: sched.seatAssignments?.map((assignment) => ({
                ...assignment,
                set: {
                    ...assignment.set,
                    seatCategory: {
                        ...assignment.set.seatCategory,
                        price: assignment.set.seatCategory.price.toString(),
                    },
                },
            })),
        })),
        categorySets: show.categorySets?.map((categorySet) => ({
            ...categorySet,
            items: categorySet.items.map((item) => ({
                ...item,
                seatCategory: {
                    ...item.seatCategory,
                    price: item.seatCategory.price.toString(), // Convert Decimal to string
                },
            })),
        })),
    };

    return (
        <>
            <PageHeader
                title={show.show_name}
                className="z-20"
                rightSlot={
                    <>
                        <ThemeSwithcer />
                        <AdminShield />
                    </>
                }
            />
            <div className="relative flex flex-1 flex-col bg-background">
                <div className="relative z-10 flex flex-1 flex-col p-4 md:p-8 pt-0 max-w-7xl mx-auto w-full">
                    {/* Header with back breadcrumb is already handled by PageHeader,
                        but we can add a specific title if needed */}
                    <div className="mb-6">
                        <h2 className="text-lg md:text-xl font-semibold">
                            Production Details
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Review production details, run-dates, and daily performance schedules.
                        </p>
                    </div>

                    <ShowDetailForm show={serializedShow} />
                </div>
            </div>
        </>
    );
}
