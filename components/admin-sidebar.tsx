"use client"

import * as React from "react"
import {
    BookOpen,
    Settings2,
    Theater,
    Armchair,
    UserRound,
    ShieldUser
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar"
import { useAppSelector } from "@/lib/hooks"
import { RootState } from "@/lib/store"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

// This is sample data.
const data = {
    teams: [
        {
            name: "user",
            logo: UserRound,
            plan: "",
        },
        {
            name: "admin",
            logo: ShieldUser,
            plan: "",
        },
    ],
    navMain: [
        {
            title: "System",
            url: "#",
            icon: Settings2,
            isActive: true,
            items: [
                {
                    title: "Dashboard",
                    url: "/admin",
                },
                {
                    title: "Settings",
                    url: "/admin/settings",
                },
                {
                    title: "Users",
                    url: "/admin/users",
                },
                {
                    title: "Admin Access",
                    url: "/admin/access",
                },
            ],
        },
        {
            title: "Shows",
            url: "#",
            icon: Theater,
            items: [
                {
                    title: "Shows List",
                    url: "/admin/shows",
                },
                {
                    title: "Calendar",
                    url: "/admin/calendar",
                },
            ],
        },
        {
            title: "Seat Map",
            url: "#",
            icon: Armchair,
            items: [
                {
                    title: "Templates",
                    url: "/admin/templates",
                },
                {
                    title: "Seatmap Designer",
                    url: "/seat-builder",
                },
            ],
        }
    ]
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const user = useAppSelector((state: RootState) => state.auth.user);
    const { isMobile, setOpenMobile } = useSidebar();
    const pathname = usePathname();
    const [isMounted, setIsMounted] = React.useState(false);

    useEffect(() => {
        if (isMobile) {
            setOpenMobile(false);
        }
    }, [pathname, isMobile, setOpenMobile]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <TeamSwitcher teams={data.teams} logo="/logo.png" logoMini="/logo-mini.png" currentTeam="admin" />
            </SidebarHeader>
            <SidebarContent>
                {isMounted && <NavMain items={data.navMain} openAll />}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={user} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar >
    )
}
