import { PageHeader } from "@/components/page-header"
import AdminShield from "@/components/AdminShield"
import { ThemeSwithcer } from "@/components/theme-swithcer"
import { getShows } from "@/lib/db/Shows"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Ticket, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function ShowsPage() {
    const shows = await getShows();

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
                        <h2 className="text-2xl font-bold tracking-tight">Show Management</h2>
                        <p className="text-muted-foreground text-sm">
                            View and manage all events, venue details, and performance schedules.
                        </p>
                    </div>
                    <Button asChild className="w-full md:w-auto font-bold uppercase tracking-wider">
                        <Link href="/admin/shows/create">
                            <Plus className="mr-2 h-4 w-4" />
                            New Show
                        </Link>
                    </Button>
                </div>

                {shows.length === 0 ? (
                    <Card className="border-dashed flex flex-col items-center justify-center p-12 text-center bg-muted/10">
                        <div className="p-4 rounded-full bg-muted mb-4">
                            <Ticket className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="text-xl mb-2 italic">AWAITING PRODUCTIONS</CardTitle>
                        <CardDescription className="max-w-xs mx-auto mb-6">
                            Your stage is currently empty. Create your first show to start managing seats and ticket sales.
                        </CardDescription>
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
                                    <div className="absolute top-4 right-4">
                                        <Badge variant={
                                            (show.show_status as any) === 'OPEN' ? 'default' :
                                                (show.show_status as any) === 'UPCOMING' ? 'secondary' : 'outline'
                                        } className="shadow-lg backdrop-blur-md font-bold italic px-3 py-1">
                                            {show.show_status}
                                        </Badge>
                                    </div>
                                </div>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="text-xl font-bold italic tracking-tight line-clamp-1 truncate">
                                            {show.show_name}
                                        </CardTitle>
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
                                        <div className="flex flex-col">
                                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Schedules</span>
                                            <span className="text-lg font-black">{show._count.scheds}</span>
                                        </div>
                                        <Button asChild variant="ghost" size="sm" className="font-bold text-primary hover:text-primary hover:bg-primary/10 group">
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
