"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Account</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-4xl mx-auto w-full overflow-hidden animate-in fade-in duration-500">
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md relative overflow-hidden">
          {/* Background Decorative Element */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <CardContent className="pt-10 pb-10 relative">
            {/* Header */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground font-medium">
                Some info here
              </p>
            </div>

            {/* Account Options */}
            <div className="space-y-0">
              {/* Switch Account */}
              <button
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3",
                  "bg-secondary/50 hover:bg-secondary/70",
                  "border border-border/50 rounded-lg",
                  "text-foreground font-medium",
                  "transition-colors duration-200",
                  "active:scale-[0.98]"
                )}
              >
                <span>Switch Account</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Separator */}
              <div className="h-px bg-border/50 my-1" />

              {/* Delete Account */}
              <button
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3",
                  "bg-secondary/50 hover:bg-secondary/70",
                  "border border-border/50 rounded-lg",
                  "text-foreground font-medium",
                  "transition-colors duration-200",
                  "active:scale-[0.98]"
                )}
              >
                <span>Delete Account</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
