"use client";

import * as React from "react";
import {
  UserRound,
  ShieldUser,
  House,
  CreditCard,
  Armchair,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAppSelector } from "@/lib/hooks";
import { RootState } from "@/lib/store";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

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
      title: "Home",
      url: "#",
      icon: House,
      isActive: true,
      items: [
        {
          title: "Upcoming Events",
          url: "/dashboard",
        },
        {
          title: "All Events",
          url: "/all-events",
        },
        {
          title: "Events Attended",
          url: "#",
        },
        {
          title: "Calendar",
          url: "#",
        },
      ],
    },
    {
      title: "Payments",
      url: "#",
      icon: CreditCard,
      items: [
        {
          title: "Payment History",
          url: "#",
        },
      ],
    },
    {
      title: "BUCAL Seats",
      url: "#",
      icon: Armchair,
      items: [
        {
          title: "Seat Layouts",
          url: "#",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useAppSelector((state: RootState) => state.auth.user);
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const logo = resolvedTheme === "dark" ? "/logo_dark.png" : "/logo_light.png";

  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={data.teams}
          logo={logo}
          logoMini="/logo-mini.png"
          currentTeam="user"
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} openAll />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
