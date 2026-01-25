"use client"

import * as React from "react"
import {
    BookOpen,
    Settings2,
    Theater,
    Armchair
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
            logo: (props: React.ComponentProps<"img">) => <img src="/user.png" alt="user" {...props} />,
            plan: "",
        },
        {
            name: "admin",
            logo: (props: React.ComponentProps<"img">) => <img src="/admin.png" alt="admin" {...props} />,
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
                    title: "Settings",
                    url: "/coming-soon",
                },
                {
                    title: "Dashboard",
                    url: "/admin",
                },
                {
                    title: "Users",
                    url: "/coming-soon",
                },
                {
                    title: "Admin Access",
                    url: "/coming-soon",
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
                    url: "/coming-soon",
                },
                {
                    title: "Create Show",
                    url: "/coming-soon",
                },
                {
                    title: "Calendar",
                    url: "/coming-soon",
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
                    url: "/coming-soon",
                },
                {
                    title: "Add Template",
                    url: "/seat-builder",
                },
                {
                    title: "Venues",
                    url: "/coming-soon",
                },
            ],
        }
    ]
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const user = useAppSelector((state: RootState) => state.auth.user);
    const { isMobile, setOpenMobile } = useSidebar();
    const pathname = usePathname();

    useEffect(() => {
        if (isMobile) {
            setOpenMobile(false);
        }
    }, [pathname, isMobile, setOpenMobile]);

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <TeamSwitcher teams={data.teams} logo="/logo.png" logoMini="/logo-mini.png" currentTeam="admin" />
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={user} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar >
    )
}
