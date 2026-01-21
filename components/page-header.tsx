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
import { StickyHeader } from "@/components/sticky-header";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  parentLabel?: string;
  parentHref?: string;
  rightSlot?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  parentLabel,
  parentHref = "#",
  rightSlot,
  className,
}: PageHeaderProps) {
  const pathname = usePathname();
  const resolvedParentLabel =
    pathname === "/account" || pathname === "/profile" ? "Dashboard" : parentLabel;
  const resolvedParentHref =
    pathname === "/account" || pathname === "/profile" ? "/dashboard" : parentHref;

  return (
    <StickyHeader
      className={cn(
        "flex shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
        className
      )}
    >
      <div className="flex items-center gap-2 px-4">
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
      {rightSlot && <div className="ml-auto px-4 flex items-center gap-3">{rightSlot}</div>}
    </StickyHeader>
  );
}
