"use client";

import * as React from "react";
import Image from "next/image";

import { TicketFieldPalette } from "@/components/ticket-template/TicketFieldPalette";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

export function TicketTemplateSidebar(
  props: React.ComponentProps<typeof Sidebar>,
) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-zinc-200 p-0 dark:border-zinc-800">
        <div className="flex h-14 items-center justify-center px-2">
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
        <TicketFieldPalette />
      </SidebarContent>

      <SidebarFooter className="border-t border-zinc-200/90 px-3 py-3 dark:border-zinc-800">
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
