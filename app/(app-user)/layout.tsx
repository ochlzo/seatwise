import { AppSidebar } from "@/components/app-sidebar"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/lib/firebaseAdmin'
import LoadingPage from "@/app/LoadingPage"

export default async function AppUserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')?.value

    if (!sessionCookie) {
        redirect('/login')
    }

    try {
        await adminAuth.verifySessionCookie(sessionCookie, true)
    } catch (error) {
        redirect('/login')
    }

    return (
        <SidebarProvider>
            <LoadingPage />
            <AppSidebar />
            <SidebarInset>
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}
