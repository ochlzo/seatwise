import LoadingPage from "@/app/LoadingPage";

export const dynamic = "force-dynamic";

export default async function AppUserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-svh overflow-x-hidden">
            <LoadingPage />
            {children}
        </div>
    );
}
