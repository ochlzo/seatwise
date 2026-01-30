import { AdminSidebar } from "@/components/admin-sidebar"
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
        <SidebarProvider className="h-svh overflow-hidden">
            <LoadingPage />
            <AdminSidebar />
            <SidebarInset className="overflow-y-auto">
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}
