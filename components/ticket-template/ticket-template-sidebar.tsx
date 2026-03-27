"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TicketFieldPalette } from "@/components/ticket-template/TicketFieldPalette";
import { buttonVariants } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function TicketTemplateSidebar(
  props: React.ComponentProps<typeof Sidebar>,
) {
  const pathname = usePathname();
  const navItems = [
    { label: "Ticket Templates", href: "/admin/ticket-templates" },
    { label: "Ticket Designer", href: "/ticket-builder" },
  ] as const;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="flex items-center justify-center px-2 py-2">
          <Image
            src="/logo_light.png"
            alt="Seatwise"
            width={120}
            height={32}
            className="h-8 w-auto object-contain dark:hidden"
            priority
          />
          <Image
            src="/logo_dark.png"
            alt="Seatwise"
            width={120}
            height={32}
            className="hidden h-8 w-auto object-contain dark:block"
            priority
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-2 pb-2">
        <div className="rounded-lg border border-zinc-200/80 bg-white/70 p-2 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="mb-2 px-1 text-xs font-medium text-zinc-500">
            Tickets
          </div>
          <div className="grid gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({
                      variant: isActive ? "secondary" : "ghost",
                      size: "sm",
                    }),
                    "h-8 justify-start px-2 text-xs",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <TicketFieldPalette />
      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        <div className="space-y-1 text-xs text-zinc-500">
          <p className="font-medium text-zinc-700 dark:text-zinc-200">Editor notes</p>
          <p>The canvas stays locked to a white 2550 x 825 export surface.</p>
          <p>Artwork layers can be reordered among themselves only.</p>
          <p>Fields and QR always render on the dedicated top layer.</p>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
