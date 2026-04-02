"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type QueueStateTone = "neutral" | "success" | "warning" | "danger";

type QueueStatePanelProps = {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: QueueStateTone;
  badgeLabel?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

const toneStyles: Record<
  QueueStateTone,
  {
    panel: string;
    icon: string;
    badge: string;
  }
> = {
  neutral: {
    panel:
      "border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border/60",
    icon: "border-border bg-muted text-foreground",
    badge: "border-border bg-background text-foreground",
  },
  success: {
    panel:
      "border-emerald-200/80 bg-emerald-50/70 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20",
    icon: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
    badge:
      "border-emerald-200 bg-emerald-100/80 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  warning: {
    panel:
      "border-amber-200/80 bg-amber-50/70 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20",
    icon: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
    badge:
      "border-amber-200 bg-amber-100/80 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  danger: {
    panel:
      "border-rose-200/80 bg-rose-50/70 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/20",
    icon: "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300",
    badge:
      "border-rose-200 bg-rose-100/80 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  },
};

export function QueueStatePanel({
  title,
  description,
  icon,
  tone = "neutral",
  badgeLabel,
  children,
  footer,
  className,
}: QueueStatePanelProps) {
  const styles = toneStyles[tone];

  return (
    <Card className={cn("overflow-hidden rounded-2xl border", styles.panel, className)}>
      <CardContent className="space-y-6 p-5 sm:p-6 md:p-7">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {icon ? (
                <div
                  className={cn(
                    "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
                    styles.icon,
                  )}
                >
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0 space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {title}
                </h2>
                {description ? (
                  <div className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                    {description}
                  </div>
                ) : null}
              </div>
            </div>
            {badgeLabel ? (
              <Badge variant="outline" className={cn("w-fit whitespace-nowrap", styles.badge)}>
                {badgeLabel}
              </Badge>
            ) : null}
          </div>
          {children ? <div className="space-y-4">{children}</div> : null}
        </div>
        {footer ? <div className="pt-1">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
