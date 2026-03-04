import { AdminSidebarClient } from "@/components/admin-sidebar-client"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import LoadingPage from "@/app/LoadingPage"

export default async function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <SidebarProvider className="h-svh overflow-hidden" suppressHydrationWarning>
            <LoadingPage />
            <AdminSidebarClient />
            <SidebarInset className="overflow-y-auto">
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}
