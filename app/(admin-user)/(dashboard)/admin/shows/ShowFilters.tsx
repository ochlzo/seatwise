"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, SortAsc, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statuses = [
    { label: "All Shows", value: "ALL" },
    { label: "Draft", value: "DRAFT" },
    { label: "Upcoming", value: "UPCOMING" },
    { label: "Open", value: "OPEN" },
    { label: "On Going", value: "ON_GOING" },
    { label: "Closed", value: "CLOSED" },
    { label: "Cancelled", value: "CANCELLED" },
    { label: "Postponed", value: "POSTPONED" },
];

const sorts = [
    { label: "Newest First", value: "newest" },
    { label: "Oldest First", value: "oldest" },
];

export function ShowFilters({
    hideStatusFilter = false,
    allowedStatusValues,
}: {
    hideStatusFilter?: boolean;
    allowedStatusValues?: string[];
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentStatus = searchParams.get("status") || "ALL";
    const currentSort = searchParams.get("sort") || "newest";

    const updateQuery = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "ALL" || (key === "sort" && value === "newest")) {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.push(`?${params.toString()}`);
    };

    const availableStatuses = allowedStatusValues
        ? statuses.filter((status) => allowedStatusValues.includes(status.value))
        : statuses;

    return (
        <div className="flex w-full items-center gap-2 md:w-auto">
            {/* Status Filter */}
            {!hideStatusFilter && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 w-1/2 gap-2 border-sidebar-border bg-background shadow-sm hover:bg-sidebar-accent transition-colors md:w-auto">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-xs">
                            {availableStatuses.find(s => s.value === currentStatus)?.label || "Filter"}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 p-1">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-2 py-1.5">
                            Filter by Status
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                    {availableStatuses.map((status) => (
                        <DropdownMenuItem
                            key={status.value}
                            onClick={() => updateQuery("status", status.value)}
                                className="flex items-center justify-between cursor-pointer text-sm py-2 rounded-md transition-colors"
                            >
                                {status.label}
                                {currentStatus === status.value && <Check className="h-4 w-4 text-primary" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* Sort Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-1/2 gap-2 border-sidebar-border bg-background shadow-sm hover:bg-sidebar-accent transition-colors md:w-auto">
                        <SortAsc className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-xs">
                            {sorts.find(s => s.value === currentSort)?.label || "Sort"}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 p-1">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-2 py-1.5">
                        Sort Order
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {sorts.map((sort) => (
                        <DropdownMenuItem
                            key={sort.value}
                            onClick={() => updateQuery("sort", sort.value)}
                            className="flex items-center justify-between cursor-pointer text-sm py-2 rounded-md transition-colors"
                        >
                            {sort.label}
                            {currentSort === sort.value && <Check className="h-4 w-4 text-primary" />}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
