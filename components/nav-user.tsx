"use client";

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
  User as UserIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/lib/hooks";
import { logout, User } from "@/lib/features/auth/authSlice";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";
import { usePathname } from "next/navigation";

export function NavUser({ user }: { user: User | null }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const pathname = usePathname();

  const handleLogout = async () => {
    dispatch(setLoading(true));
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      dispatch(logout());
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed", error);
      dispatch(setLoading(false));
    }
  };

  const name = user?.displayName || user?.username || "User";
  const email = user?.email || "";
  const avatar = user?.photoURL || undefined;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleProfileClick = () => {
    if (pathname !== "/profile") {
      dispatch(setLoading(true));
    }
    router.push("/profile");
  };

  const handleAccountClick = () => {
    if (pathname !== "/account") {
      dispatch(setLoading(true));
    }
    router.push("/account");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleProfileClick}>
                <UserIcon />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAccountClick}>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
