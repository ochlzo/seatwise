import { AppSidebar } from "@/components/app-sidebar"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import LoadingPage from "@/app/LoadingPage"
import { verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic";

export default async function AppUserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await verifySession();

    return (
        <SidebarProvider className="h-svh overflow-hidden" suppressHydrationWarning>
            <LoadingPage />
            <AppSidebar />
            <SidebarInset className="overflow-y-auto">
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}
