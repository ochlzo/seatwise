"use client";

import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { ShowFilters } from "./ShowFilters";
import AdminShield from "@/components/AdminShield";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Ticket, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
    UPCOMING: "#3B82F6",
    DRAFT: "#64748B",
    OPEN: "#22C55E",
    CLOSED: "#6B7280",
    ON_GOING: "#F59E0B",
    CANCELLED: "#EF4444",
    POSTPONED: "#A855F7",
};

const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).toLowerCase().replace(':00', '').replace(' ', '');
};

type Show = {
    show_id: string;
    show_name: string;
    show_description: string;
    venue: string;
    address: string;
    show_status: string;
    show_start_date: Date;
    show_end_date: Date;
    show_image_key?: string | null;
    seatmap_id?: string | null;
    scheds: Array<{
        sched_start_time: Date;
        sched_end_time: Date;
    }>;
};

type ShowsClientProps = {
    mode?: "admin" | "user";
    basePath?: string;
    enableLinks?: boolean;
    showHeader?: boolean;
    showFilters?: boolean;
};

export default function ShowsPage({
    mode = "admin",
    basePath = "/admin/shows",
    enableLinks = true,
    showHeader = true,
    showFilters = true,
}: ShowsClientProps) {
    const searchParams = useSearchParams();
    const [shows, setShows] = React.useState<Show[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState("");

    React.useEffect(() => {
        const fetchShows = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();

                if (searchQuery.trim()) {
                    params.set("q", searchQuery.trim());
                }

                const status = searchParams.get("status");
                const sort = searchParams.get("sort");
                const seatmapId = searchParams.get("seatmapId");

                if (status) params.set("status", status);
                if (sort) params.set("sort", sort);
                if (seatmapId) params.set("seatmapId", seatmapId);

                const response = await fetch(`/api/shows/search?${params.toString()}`);

                if (response.status === 401) {
                    // Unauthorized - redirect to login
                    window.location.href = "/login";
                    return;
                }

                if (!response.ok) {
                    throw new Error("Failed to fetch shows");
                }

                const data = await response.json();
                setShows(data.shows || []);
            } catch (error) {
                console.error("Failed to fetch shows:", error);
                setShows([]);
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchShows();
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery, searchParams]);

    const hasFilters = searchParams.get("status") || searchParams.get("sort") || searchParams.get("seatmapId") || searchQuery.trim();

    const isAdmin = mode === "admin";
    const createPath = `${basePath}/create`;

    return (
        <>
            {showHeader && (
                <PageHeader
                    title="Shows"
                    rightSlot={
                        isAdmin ? (
                            <>
                                <ThemeSwithcer />
                                <AdminShield />
                            </>
                        ) : undefined
                    }
                />
            )}
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 pt-0">
                {/* Header Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg md:text-xl font-semibold">Show Management</h2>
                        <p className="text-muted-foreground text-sm">
                            View and manage all events, venue details, and performance schedules.
                        </p>
                    </div>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <div className="relative w-full md:flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search shows by name..."
                                className="border-input h-9 w-full rounded-md border bg-transparent pl-9 pr-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                            />
                        </div>
                        {isAdmin && (
                            <Button asChild className="w-full md:w-auto font-semibold shadow-md shadow-primary/10">
                                <Link href={createPath}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Show
                                </Link>
                            </Button>
                        )}
                        {showFilters && (
                            <div className="w-full md:w-auto">
                                <ShowFilters />
                            </div>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="text-muted-foreground">Loading shows...</div>
                    </div>
                ) : shows.length === 0 ? (
                    <Card className="border-dashed flex flex-col items-center justify-center p-12 text-center bg-muted/10">
                        <div className="p-4 rounded-full bg-muted mb-4">
                            <Ticket className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="text-lg md:text-xl mb-2 font-semibold">
                            {hasFilters ? "NO MATCHING PRODUCTIONS" : "AWAITING PRODUCTIONS"}
                        </CardTitle>
                        <CardDescription className="max-w-xs mx-auto mb-6">
                            {hasFilters
                                ? "No shows match your current filter criteria. Try adjusting your filters or clearing them to see all shows."
                                : "Your stage is currently empty. Create your first show to start managing seats and ticket sales."
                            }
                        </CardDescription>
                        {hasFilters && (
                            <Button variant="outline" asChild size="sm">
                                <Link href={basePath}>Clear Filters</Link>
                            </Button>
                        )}
                    </Card>
                ) : (
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {shows.map((show: Show) => (
                            enableLinks ? (
                                <Link key={show.show_id} href={`${basePath}/${show.show_id}`}>
                                    <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-sidebar-border cursor-pointer h-full">
                                        <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                                            {show.show_image_key ? (
                                                <Image
                                                    src={show.show_image_key}
                                                    alt={show.show_name}
                                                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                                    width={400}
                                                    height={225}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                                                    <Ticket className="w-12 h-12 text-primary/20" />
                                                </div>
                                            )}
                                        </div>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <CardTitle className="text-lg md:text-xl font-semibold line-clamp-1 truncate">
                                                    {show.show_name}
                                                </CardTitle>
                                                <Badge
                                                    variant="outline"
                                                    style={{
                                                        backgroundColor: STATUS_COLORS[show.show_status as string] || "#6B7280",
                                                        color: "white",
                                                        borderColor: "transparent"
                                                    }}
                                                    className="shadow-sm font-semibold px-3 py-1 text-xs shrink-0"
                                                >
                                                    {show.show_status.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                            <CardDescription className="flex items-center gap-1.5 font-medium text-primary/80">
                                                <MapPin className="w-3.5 h-3.5" />
                                                <span className="line-clamp-1">{show.venue}</span>
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar className="w-4 h-4" />
                                                    <span className="font-medium">
                                                        {new Date(show.show_start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        {new Date(show.show_start_date).getTime() !== new Date(show.show_end_date).getTime() ?
                                                            ` - ${new Date(show.show_end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` :
                                                            `, ${new Date(show.show_start_date).getFullYear()}`
                                                        }
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-sidebar-border">
                                                <div className="flex flex-col max-w-full">
                                                    <span className="text-xs text-muted-foreground font-semibold">Schedules</span>
                                                    <span className="text-sm font-semibold line-clamp-1 text-primary/90">
                                                        {(() => {
                                                            const uniqueTimes = Array.from(new Set(
                                                                show.scheds.map(s =>
                                                                    `${formatTime(new Date(s.sched_start_time))} - ${formatTime(new Date(s.sched_end_time))}`
                                                                )
                                                            ));
                                                            return uniqueTimes.length > 0 ? uniqueTimes.join(', ') : "None";
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ) : (
                                <Card key={show.show_id} className="overflow-hidden border-sidebar-border h-full">
                                    <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                                        {show.show_image_key ? (
                                            <Image
                                                src={show.show_image_key}
                                                alt={show.show_name}
                                                className="object-cover w-full h-full"
                                                width={400}
                                                height={225}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                                                <Ticket className="w-12 h-12 text-primary/20" />
                                            </div>
                                        )}
                                    </div>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <CardTitle className="text-lg md:text-xl font-semibold line-clamp-1 truncate">
                                                {show.show_name}
                                            </CardTitle>
                                            <Badge
                                                variant="outline"
                                                style={{
                                                    backgroundColor: STATUS_COLORS[show.show_status as string] || "#6B7280",
                                                    color: "white",
                                                    borderColor: "transparent"
                                                }}
                                                className="shadow-sm font-semibold px-3 py-1 text-xs shrink-0"
                                            >
                                                {show.show_status.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                        <CardDescription className="flex items-center gap-1.5 font-medium text-primary/80">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span className="line-clamp-1">{show.venue}</span>
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="w-4 h-4" />
                                                <span className="font-medium">
                                                    {new Date(show.show_start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    {new Date(show.show_start_date).getTime() !== new Date(show.show_end_date).getTime() ?
                                                        ` - ${new Date(show.show_end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` :
                                                        `, ${new Date(show.show_start_date).getFullYear()}`
                                                    }
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-sidebar-border">
                                            <div className="flex flex-col max-w-full">
                                                <span className="text-xs text-muted-foreground font-semibold">Schedules</span>
                                                <span className="text-sm font-semibold line-clamp-1 text-primary/90">
                                                    {(() => {
                                                        const uniqueTimes = Array.from(new Set(
                                                            show.scheds.map(s =>
                                                                `${formatTime(new Date(s.sched_start_time))} - ${formatTime(new Date(s.sched_end_time))}`
                                                            )
                                                        ));
                                                        return uniqueTimes.length > 0 ? uniqueTimes.join(', ') : "None";
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
