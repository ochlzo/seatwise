import { ComingSoonClient } from "@/components/coming-soon-client"
import { PageHeader } from "@/components/page-header"
import AdminShield from "@/components/AdminShield"
import { ThemeSwithcer } from "@/components/theme-swithcer"

export default async function CatchAllComingSoonPage({
    params,
}: {
    params: Promise<{ slug: string[] }>
}) {
    const { slug } = await params;

    // Format the last segment of the slug to be the title
    const rawTitle = slug[slug.length - 1] || "Feature";
    const formattedTitle = rawTitle
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    return (
        <>
            <PageHeader
                title={formattedTitle}
                rightSlot={
                    <>
                        <ThemeSwithcer />
                        <AdminShield />
                    </>
                }
            />
            <ComingSoonClient />
        </>
    )
}
