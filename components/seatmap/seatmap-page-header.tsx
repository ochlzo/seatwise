"use client";

import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type SeatmapPageHeaderProps = {
  title: string;
  parentLabel?: string;
  parentHref?: string;
  rightSlot?: React.ReactNode;
  className?: string;
};

export function SeatmapPageHeader({
  title,
  parentLabel,
  parentHref = "#",
  rightSlot,
  className,
}: SeatmapPageHeaderProps) {
  const pathname = usePathname();
  const resolvedParentLabel =
    pathname === "/account" || pathname === "/profile" ? "Dashboard" : parentLabel;
  const resolvedParentHref =
    pathname === "/account" || pathname === "/profile" ? "/dashboard" : parentHref;

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-4 text-zinc-900 transition-[width,height] ease-linear dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb className="hidden md:block">
          <BreadcrumbList>
            {resolvedParentLabel && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink href={resolvedParentHref}>
                    {resolvedParentLabel}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <span className="text-sm font-medium md:hidden">{title}</span>
      </div>
      {rightSlot && (
        <div className="ml-auto flex items-center gap-3 px-4">{rightSlot}</div>
      )}
    </header>
  );
}
