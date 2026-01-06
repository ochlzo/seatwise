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
} from "@/components/ui/sidebar"
import { useAppSelector } from "@/lib/hooks"
import { RootState } from "@/lib/store"

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
                    url: "#",
                },
                {
                    title: "Dashboard",
                    url: "#",
                },
                {
                    title: "Users",
                    url: "#",
                },
                {
                    title: "Admin Access",
                    url: "#",
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
                    url: "#",
                },
                {
                    title: "Create Show",
                    url: "#",
                },
                {
                    title: "Calendar",
                    url: "#",
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
                    url: "#",
                },
                {
                    title: "Add Template",
                    url: "#",
                },
                {
                    title: "Venues",
                    url: "#",
                },
            ],
        }
    ]
}

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const user = useAppSelector((state: RootState) => state.auth.user);
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
