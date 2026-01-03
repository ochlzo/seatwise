"use client"

import * as React from "react"

import { ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { RootState } from "@/lib/store";
import { useAppSelector } from "@/lib/hooks";

export function TeamSwitcher({
  teams,
  logo = "/logo.png",
  logoMini = "/logo-mini.png",
  currentTeam,
}: {
  teams: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
  logo?: string
  logoMini?: string
  currentTeam?: string
}) {
  const { isMobile, state } = useSidebar()
  const user = useAppSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";

  const [activeTeam, setActiveTeam] = React.useState(
    teams.find(t => t.name === currentTeam) || teams[0]
  )

  if (!activeTeam) {
    return null
  }

  const content = (
    <SidebarMenuButton
      size="lg"
      className={cn(
        "h-14",
        isAdmin && "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
        !isAdmin && "hover:bg-transparent active:bg-transparent cursor-default"
      )}
    >
      <div className={cn(
        "flex flex-1 items-center justify-start overflow-hidden",
        state === "collapsed" && "justify-center"
      )}>
        <img
          src={state === "collapsed" ? logoMini : logo}
          alt="Seatwise"
          className={state === "collapsed" ? "size-9 object-contain" : "h-11 w-auto max-w-full object-contain"}
        />
      </div>
      {isAdmin && state !== "collapsed" && <ChevronsUpDown className="ml-auto size-4 shrink-0" />}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {content}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                User Mode
              </DropdownMenuLabel>
              {teams.map((team, index) => (
                <DropdownMenuItem
                  key={team.name}
                  onClick={() => {
                    if (team.name !== currentTeam) {
                      setActiveTeam(team)
                    }
                  }}
                  className={cn(
                    "gap-2 p-2 group cursor-pointer",
                    team.name === currentTeam && "opacity-50 cursor-default"
                  )}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <team.logo className="size-3.5 shrink-0" />
                  </div>
                  {team.name}
                  <span className={cn(
                    "ml-auto text-xs text-muted-foreground transition-opacity",
                    team.name === currentTeam ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {team.name === currentTeam ? "current" : "switch"}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          content
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
