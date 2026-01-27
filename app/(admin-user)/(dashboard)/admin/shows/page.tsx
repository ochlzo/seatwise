import { PageHeader } from "@/components/page-header"
import { ShowFilters } from "./ShowFilters"
import AdminShield from "@/components/AdminShield"
import { ThemeSwithcer } from "@/components/theme-swithcer"
import { getShows } from "@/lib/db/Shows"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Ticket, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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


export default async function ShowsPage({
    searchParams
}: {
    searchParams: Promise<{ status?: string; sort?: string; seatmapId?: string }>
}) {
    const params = await searchParams;
    const shows = await getShows(params);

    const hasFilters = params.status || params.sort || params.seatmapId;

    return (
        <>
            <PageHeader
                title="Shows"
                rightSlot={
                    <>
                        <ThemeSwithcer />
                        <AdminShield />
                    </>
                }
            />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 pt-0">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg md:text-xl font-semibold">Show Management</h2>
                        <p className="text-muted-foreground text-sm">
                            View and manage all events, venue details, and performance schedules.
                        </p>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-3">
                        <Button asChild className="w-full md:w-auto font-semibold shadow-md shadow-primary/10 order-1 md:order-none">
                            <Link href="/admin/shows/create">
                                <Plus className="mr-2 h-4 w-4" />
                                New Show
                            </Link>
                        </Button>
                        <div className="w-full md:w-auto order-2 md:order-none">
                            <ShowFilters />
                        </div>
                    </div>
                </div>

                {shows.length === 0 ? (
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
                                <Link href="/admin/shows">Clear Filters</Link>
                            </Button>
                        )}
                    </Card>
                ) : (
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {shows.map((show: any) => (
                            <Card key={show.show_id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-sidebar-border">
                                <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                                    {show.show_image_key ? (
                                        <img
                                            src={show.show_image_key}
                                            alt={show.show_name}
                                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
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
                                                {show.show_start_date.getTime() !== show.show_end_date.getTime() ?
                                                    ` - ${new Date(show.show_end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` :
                                                    `, ${new Date(show.show_start_date).getFullYear()}`
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-sidebar-border">
                                        <div className="flex flex-col max-w-[180px]">
                                            <span className="text-xs text-muted-foreground font-semibold">Schedules</span>
                                            <span className="text-sm font-semibold line-clamp-1 text-primary/90">
                                                {show.scheds.length > 0
                                                    ? show.scheds.map((s: any) => `${formatTime(new Date(s.sched_start_time))} - ${formatTime(new Date(s.sched_end_time))}`).join(', ')
                                                    : "None"}
                                            </span>
                                        </div>
                                        <Button asChild variant="ghost" size="sm" className="font-semibold text-primary hover:text-primary hover:bg-primary/10 group">
                                            <Link href={`/admin/shows/${show.show_id}`}>
                                                View Details
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}
