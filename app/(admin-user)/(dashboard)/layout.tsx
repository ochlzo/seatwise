import { AdminSidebarClient } from "@/components/admin-sidebar-client"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import LoadingPage from "@/app/LoadingPage"
import { verifyAdmin } from '@/lib/auth/admin'

export default async function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Verify admin access before rendering
    await verifyAdmin();
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
