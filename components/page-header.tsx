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

const segmentMap: Record<string, string> = {
  dashboard: "Dashboard",
  profile: "Profile",
  account: "Account",
  admin: "Admin Dashboard",
  "seat-builder": "Seatmap Builder",
};

const formatSegment = (segment: string) => {
  if (segmentMap[segment]) return segmentMap[segment];
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

type PageHeaderProps = {
  title: string;
  parentLabel?: string;
  parentHref?: string;
  rightSlot?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  rightSlot,
  className,
}: PageHeaderProps) {
  const pathname = usePathname();

  const breadcrumbs = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];

    // Always start with Home
    crumbs.push({ label: "Home", href: "/" });

    let currentHref = "";

    // Add Dashboard as root if we are in a subpage of user routes
    if (!pathname.startsWith("/admin") && segments[0] !== "dashboard" && segments.length > 0) {
      crumbs.push({ label: "Dashboard", href: "/dashboard" });
    }

    // Process segments
    segments.forEach((segment) => {
      currentHref += `/${segment}`;
      crumbs.push({
        label: formatSegment(segment),
        href: currentHref,
      });
    });

    return crumbs;
  }, [pathname]);

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
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.href}>
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{title || crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={crumb.href}>
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <span className="text-sm font-medium md:hidden">{title}</span>
      </div>
      {rightSlot && <div className="ml-auto px-4 flex items-center gap-3">{rightSlot}</div>}
    </StickyHeader>
  );
}
