"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { SchedulePickerOption } from "@/lib/shows/schedulePicker";
import { isSchedStatusReservable } from "@/lib/shows/reservationEligibility";

const SCHEDULE_STATUS_LABELS: Record<
  NonNullable<SchedulePickerOption["effective_status"]>,
  string
> = {
  OPEN: "Open",
  ON_GOING: "On Going",
  FULLY_BOOKED: "Fully Booked",
  CLOSED: "Closed",
};

type Step = "date" | "time";

interface ScheduleSelectionDialogProps {
  confirmButtonLabel: string;
  onConfirm: (schedId: string) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  schedules: SchedulePickerOption[];
  showName: string;
}

export function ScheduleSelectionDialog({
  confirmButtonLabel,
  onConfirm,
  onOpenChange,
  open,
  schedules,
  showName,
}: ScheduleSelectionDialogProps) {
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSchedId, setSelectedSchedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, SchedulePickerOption[]>();
    for (const schedule of schedules) {
      const dateKey = schedule.sched_date.split("T")[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)?.push(schedule);
    }
    return grouped;
  }, [schedules]);

  const availableDates = useMemo(
    () => Array.from(schedulesByDate.keys()).map((dateStr) => parseLocalDate(dateStr)),
    [schedulesByDate],
  );

  const schedulesForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return schedulesByDate.get(formatLocalDate(selectedDate)) ?? [];
  }, [selectedDate, schedulesByDate]);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);

  const formatTime = (time: string) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(`1970-01-01T${time}`));

  const resetState = () => {
    setStep("date");
    setSelectedDate(undefined);
    setSelectedSchedId(null);
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) return;
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateKey = formatLocalDate(date);
    if (!schedulesByDate.has(dateKey)) return;
    setSelectedDate(date);
    setSelectedSchedId(null);
  };

  const handleDateConfirm = () => {
    if (!selectedDate) return;
    setStep("time");
  };

  const handleBack = () => {
    setStep("date");
    setSelectedSchedId(null);
  };

  const handleConfirmClick = async () => {
    if (!selectedSchedId) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedSchedId);
      resetState();
    } catch {
      // Keep the dialog state intact when the caller reports an error.
    } finally {
      setIsSubmitting(false);
    }
  };

  const disabledDates = (date: Date) => !schedulesByDate.has(formatLocalDate(date));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        {step === "date" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Select a Date</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Choose which date you&apos;d like to attend {showName}
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-center py-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={disabledDates}
                className="rounded-md border"
                modifiers={{ available: availableDates }}
                modifiersClassNames={{
                  available: "bg-blue-100 dark:bg-blue-900 font-semibold",
                }}
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} className="text-xs sm:text-sm">
                Cancel
              </Button>
              <Button onClick={handleDateConfirm} disabled={!selectedDate} className="text-xs sm:text-sm">
                Confirm
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="text-left">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1 text-left">
                  <DialogTitle className="text-base sm:text-lg">Select Time Slot</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    {selectedDate ? formatDate(selectedDate) : ""}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="max-h-[420px] space-y-3 overflow-y-auto py-4 pr-1">
              <RadioGroup value={selectedSchedId ?? ""} onValueChange={setSelectedSchedId}>
                {schedulesForSelectedDate.map((schedule) => {
                  const categories = schedule.categories ?? [];
                  const isScheduleDisabled =
                    schedule.effective_status != null &&
                    !isSchedStatusReservable(schedule.effective_status);

                  return (
                    <Card
                      key={schedule.sched_id}
                      className={`rounded-xl border py-0 transition-all ${
                        isScheduleDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-md"
                      } ${
                        selectedSchedId === schedule.sched_id
                          ? "ring-2 ring-blue-600 bg-blue-50/80 dark:bg-blue-950/20"
                          : "hover:bg-muted/40"
                      }`}
                      onClick={() => {
                        if (isScheduleDisabled) return;
                        setSelectedSchedId(schedule.sched_id);
                      }}
                    >
                      <CardContent className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <RadioGroupItem
                            value={schedule.sched_id}
                            id={schedule.sched_id}
                            className="mt-1 shrink-0"
                            disabled={isScheduleDisabled}
                          />
                          <Label
                            htmlFor={schedule.sched_id}
                            className={`flex-1 !items-start !gap-0 ${
                              isScheduleDisabled ? "cursor-not-allowed" : "cursor-pointer"
                            }`}
                          >
                            <div className="w-full space-y-3">
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="text-sm font-semibold sm:text-base">
                                    {formatTime(schedule.sched_start_time)} - {formatTime(schedule.sched_end_time)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {selectedDate ? formatDate(selectedDate) : ""}
                                  </div>
                                </div>
                                {schedule.effective_status && schedule.effective_status !== "OPEN" ? (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 border-transparent text-[10px] uppercase tracking-wide"
                                  >
                                    {SCHEDULE_STATUS_LABELS[schedule.effective_status]}
                                  </Badge>
                                ) : null}
                              </div>

                              {categories.length > 0 ? (
                                <div className="flex flex-wrap gap-2 pl-0">
                                  {categories.map((category) => (
                                    <div
                                      key={`${schedule.sched_id}-${category.name}`}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border/60 bg-background px-2.5 py-1 text-[10px] sm:text-xs"
                                    >
                                      <span className="font-medium">{category.name}</span>
                                      <span className="whitespace-nowrap text-muted-foreground">
                                        PHP {Number.parseFloat(category.price).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </RadioGroup>
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs sm:text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleConfirmClick()}
                disabled={!selectedSchedId || isSubmitting}
                className="text-xs sm:text-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {confirmButtonLabel}
                  </>
                ) : (
                  confirmButtonLabel
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
