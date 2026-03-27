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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setTitle } from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { cn } from "@/lib/utils";

type TicketTemplatePageHeaderProps = {
  rightSlot?: React.ReactNode;
  className?: string;
};

export function TicketTemplatePageHeader({
  rightSlot,
  className,
}: TicketTemplatePageHeaderProps) {
  const dispatch = useAppDispatch();
  const title = useAppSelector((state) => state.ticketTemplate.title);

  return (
    <header
      className={cn(
        "flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 text-zinc-900 transition-[width,height] ease-linear dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:min-h-12",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb className="hidden md:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/ticket-templates">
                Ticket Templates
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Ticket Designer</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <span className="text-sm font-medium md:hidden">Ticket Designer</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Input
          value={title}
          onChange={(event) => dispatch(setTitle(event.target.value))}
          placeholder="Template title"
          className="h-9 max-w-full bg-zinc-50 text-sm font-semibold md:w-[320px] dark:bg-zinc-800/60"
        />
      </div>

      {rightSlot ? (
        <div className="ml-auto flex items-center gap-2">{rightSlot}</div>
      ) : null}
    </header>
  );
}
