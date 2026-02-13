"use client";

import * as React from "react";

import { ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { RootState } from "@/lib/store";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";

export function TeamSwitcher({
  teams,
  logo = "/logo.png",
  logoLight,
  logoDark,
  logoMini = "/logo-mini.png",
  currentTeam,
}: {
  teams: {
    name: string;
    logo: React.ComponentType<{ className?: string }>;
    plan: string;
  }[];
  logo?: string;
  logoLight?: string;
  logoDark?: string;
  logoMini?: string;
  currentTeam?: string;
}) {
  const { isMobile, state } = useSidebar();
  const user = useAppSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [activeTeam, setActiveTeam] = React.useState(
    teams.find((t) => t.name === currentTeam) || teams[0],
  );

  if (!activeTeam) {
    return null;
  }

  const content = (
    <SidebarMenuButton
      size="lg"
      onClick={() => {
        if (!isAdmin) {
          dispatch(setLoading(true));
          router.push("/");
        }
      }}
      className={cn(
        "h-14",
        isAdmin &&
        "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
        !isAdmin && "cursor-pointer",
      )}
    >
      <div
        className={cn(
          "flex flex-1 items-center justify-start overflow-hidden",
          isMobile === true && "justify-center",
          state === "collapsed" && "justify-center",
        )}
      >
        <div
          className={cn(
            "relative",
            state === "collapsed" ? "size-10" : "h-14 w-full",
            isMobile === true && "mx-auto",
          )}
        >
          {state === "collapsed" ? (
            <Image
              src={logoMini}
              alt="Seatwise"
              fill
              className="object-contain"
            />
          ) : logoLight && logoDark ? (
            <>
              <Image
                src={logoLight}
                alt="Seatwise"
                fill
                className="object-contain dark:hidden"
              />
              <Image
                src={logoDark}
                alt="Seatwise"
                fill
                className="hidden object-contain dark:block"
              />
            </>
          ) : (
            <Image src={logo} alt="Seatwise" fill className="object-contain" />
          )}
        </div>
      </div>
      {isAdmin && state !== "collapsed" && (
        <ChevronsUpDown className="ml-auto size-4 shrink-0" />
      )}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{content}</DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile === true ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                User Mode
              </DropdownMenuLabel>
              {teams.map((team) => {
                const Logo = team.logo;
                return (
                  <DropdownMenuItem
                    key={team.name}
                    onClick={() => {
                      if (team.name !== currentTeam) {
                        setActiveTeam(team);
                        dispatch(setLoading(true));
                        if (team.name === "admin") {
                          router.push("/admin");
                        } else if (team.name === "user") {
                          router.push("/dashboard");
                        }
                      }
                    }}
                    className={cn(
                      "gap-2 p-2 group cursor-pointer",
                      team.name === currentTeam && "opacity-50 cursor-default",
                    )}
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                      <Logo className="size-4 shrink-0" />
                    </div>
                    {team.name}
                    <span
                      className={cn(
                        "ml-auto text-xs text-muted-foreground transition-opacity",
                        team.name === currentTeam
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100",
                      )}
                    >
                      {team.name === currentTeam ? "current" : "switch"}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          content
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
