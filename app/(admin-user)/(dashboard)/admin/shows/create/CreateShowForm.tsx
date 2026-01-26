"use client";

import * as React from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createShowAction } from "@/lib/actions/createShow";

const STATUS_OPTIONS = [
  "DRAFT",
  "UPCOMING",
  "OPEN",
  "CLOSED",
  "ON_GOING",
  "CANCELLED",
  "POSTPONED",
];

type SchedDraft = {
  id: string;
  sched_date: string;
  sched_start_time: string;
  sched_end_time: string;
};

export function CreateShowForm() {
  const router = useRouter();
  const [isSaving, setIsSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    show_name: "",
    show_description: "",
    venue: "",
    address: "",
    show_status: "DRAFT",
    show_start_date: "",
    show_end_date: "",
    show_image_key: "",
  });
  const [scheds, setScheds] = React.useState<SchedDraft[]>([]);

  const addSched = () => {
    setScheds((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        sched_date: "",
        sched_start_time: "19:00",
        sched_end_time: "21:00",
      },
    ]);
  };

  const removeSched = (id: string) => {
    setScheds((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSched = (id: string, patch: Partial<SchedDraft>) => {
    setScheds((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const handleSave = async () => {
    if (
      !formData.show_name ||
      !formData.show_description ||
      !formData.venue ||
      !formData.address ||
      !formData.show_start_date ||
      !formData.show_end_date
    ) {
      toast.error("Please fill out all required fields.");
      return;
    }

    const validScheds = scheds.filter(
      (s) => s.sched_date && s.sched_start_time && s.sched_end_time
    );

    setIsSaving(true);
    const result = await createShowAction({
      ...formData,
      scheds: validScheds,
      show_image_key: formData.show_image_key || undefined,
    });
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error || "Failed to create show");
      return;
    }

    toast.success("Show created successfully");
    router.push(`/admin/shows/${result.showId}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <Card className="border-sidebar-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl font-semibold">
            Show Details
          </CardTitle>
          <CardDescription>Set up a new production.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="show-name" className="text-xs font-semibold text-muted-foreground">
                Show Name
              </Label>
              <Input
                id="show-name"
                value={formData.show_name}
                onChange={(e) => setFormData({ ...formData, show_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="show-status" className="text-xs font-semibold text-muted-foreground">
                Status
              </Label>
              <select
                id="show-status"
                value={formData.show_status}
                onChange={(e) => setFormData({ ...formData, show_status: e.target.value })}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="show-description" className="text-xs font-semibold text-muted-foreground">
              Production Description
            </Label>
            <textarea
              id="show-description"
              value={formData.show_description}
              onChange={(e) => setFormData({ ...formData, show_description: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue" className="text-xs font-semibold text-muted-foreground">
                Venue
              </Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-xs font-semibold text-muted-foreground">
                Full Address
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-xs font-semibold text-muted-foreground">
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={formData.show_start_date}
                onChange={(e) => setFormData({ ...formData, show_start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-xs font-semibold text-muted-foreground">
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={formData.show_end_date}
                onChange={(e) => setFormData({ ...formData, show_end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image-key" className="text-xs font-semibold text-muted-foreground">
              Image URL (optional)
            </Label>
            <Input
              id="image-key"
              value={formData.show_image_key}
              onChange={(e) => setFormData({ ...formData, show_image_key: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-sidebar-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg md:text-xl font-semibold">
              Schedule
            </CardTitle>
            <CardDescription>Add performance dates and times.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addSched} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Schedule
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheds.length === 0 && (
            <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-sm text-muted-foreground">
              No schedules yet. Add at least one if you want predefined showtimes.
            </div>
          )}
          {scheds.map((s) => (
            <div
              key={s.id}
              className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] items-end rounded-lg border border-sidebar-border/60 p-3"
            >
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Date
                </Label>
                <Input
                  type="date"
                  value={s.sched_date}
                  onChange={(e) => updateSched(s.id, { sched_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Starts
                </Label>
                <Input
                  type="time"
                  value={s.sched_start_time}
                  onChange={(e) => updateSched(s.id, { sched_start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Ends
                </Label>
                <Input
                  type="time"
                  value={s.sched_end_time}
                  onChange={(e) => updateSched(s.id, { sched_end_time: e.target.value })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:bg-destructive/10"
                onClick={() => removeSched(s.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? "Creating..." : "Create Show"}
        </Button>
      </div>
    </div>
  );
}
