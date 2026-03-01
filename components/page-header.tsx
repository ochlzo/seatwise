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
  reservations: "Reservations",
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
  parentLabel,
  parentHref,
  rightSlot,
  className,
}: PageHeaderProps) {
  const pathname = usePathname();
  const hasSidebar = pathname.startsWith("/admin") || pathname.startsWith("/seat-builder");

  const breadcrumbs = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];

    // Always start with Home
    crumbs.push({ label: "Home", href: "/" });

    // Simplified app-user queue/reserve breadcrumbs:
    // Home > Dashboard > Show Name > Queue
    // Home > Dashboard > Show Name > Reserve Seats
    if (segments[0] === "queue" && segments.length >= 3) {
      crumbs.push({ label: "Dashboard", href: "/dashboard" });
      if (parentLabel) {
        crumbs.push({ label: parentLabel, href: parentHref ?? `/${segments[1]}` });
      }
      crumbs.push({ label: "Queue", href: "/queue" });
      return crumbs;
    }

    if (segments[0] === "reserve" && segments.length >= 3) {
      crumbs.push({ label: "Dashboard", href: "/dashboard" });
      if (parentLabel) {
        crumbs.push({ label: parentLabel, href: parentHref ?? `/${segments[1]}` });
      }
      crumbs.push({ label: "Reserve Seats", href: "/reserve" });
      return crumbs;
    }

    let currentHref = "";

    // Logic for parent breadcrumb (Dashboard/Admin Dashboard)
    const isAdminRoute = pathname.startsWith("/admin") || pathname === "/seat-builder";

    if (!isAdminRoute && segments[0] !== "dashboard" && segments.length > 0) {
      crumbs.push({ label: "Dashboard", href: "/dashboard" });
    } else if (pathname === "/seat-builder") {
      crumbs.push({ label: "Admin Dashboard", href: "/admin" });
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
      <div className="flex items-center gap-2 px-3 sm:px-4">
        {hasSidebar && (
          <>
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-1 sm:mr-2 data-[orientation=vertical]:h-3 sm:data-[orientation=vertical]:h-4"
            />
          </>
        )}
        <Breadcrumb className="hidden md:block">
          <BreadcrumbList className="text-xs sm:text-sm">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.href}>
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="text-xs sm:text-sm font-medium">{title || crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={crumb.href} className="text-xs sm:text-sm">
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator className="text-xs sm:text-sm" />}
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <span className="text-xs sm:text-sm font-medium md:hidden">{title}</span>
      </div>
      {rightSlot && <div className="ml-auto px-3 sm:px-4 flex items-center gap-2 sm:gap-3">{rightSlot}</div>}
    </StickyHeader>
  );
}
