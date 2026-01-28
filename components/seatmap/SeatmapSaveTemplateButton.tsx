"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UploadProgress } from "@/components/ui/upload-progress";
import { saveSeatmapTemplateAction } from "@/lib/actions/saveSeatmapTemplate";
import { calculateFitViewport } from "@/lib/seatmap/view-utils";
import { toast } from "sonner";
import { markSeatmapSaved } from "@/lib/features/seatmap/seatmapSlice";

export function SeatmapSaveTemplateButton() {
  const seatmap = useAppSelector((state) => state.seatmap);
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const seatmapId = searchParams.get("seatmapId") ?? undefined;
  const [isSaving, setIsSaving] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [files, setFiles] = React.useState<{ name: string; size: number }[]>([]);

  const handleSave = async () => {
    const name = seatmap.title?.trim();
    if (!name) {
      toast.error("Seatmap name is required.");
      return;
    }

    // Check if canvas is empty
    if (Object.keys(seatmap.nodes).length === 0) {
      toast.error("Cannot save an empty seatmap. Please add some seats or shapes first.");
      return;
    }

    // Check for seats without seat numbers
    const seats = Object.values(seatmap.nodes).filter((node) => node.type === "seat");
    const seatsWithoutNumbers = seats.filter(
      (seat) => seat.seatNumber === undefined || seat.seatNumber === null
    );
    if (seatsWithoutNumbers.length > 0) {
      toast.error(
        `${seatsWithoutNumbers.length} seat(s) don't have seat numbers assigned. Please assign seat numbers before saving.`
      );
      return;
    }

    setIsSaving(true);
    setProgress(0);

    const exportData = {
      title: seatmap.title,
      nodes: seatmap.nodes,
      viewport: calculateFitViewport(seatmap.nodes, seatmap.viewportSize),
      snapSpacing: seatmap.snapSpacing,
      exportedAt: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(exportData);
    const fileSize = new Blob([jsonString]).size;
    setFiles([{ name: `${name}.json`, size: fileSize }]);

    let currentProgress = 15;
    setProgress(currentProgress);

    try {
      const result = await saveSeatmapTemplateAction({
        seatmap_name: name,
        seatmap_json: exportData,
        seatmap_id: seatmapId,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to save seatmap");
      }

      currentProgress = 100;
      setProgress(currentProgress);
      toast.success(seatmapId ? "Seatmap updated." : "Seatmap saved to templates.");
      dispatch(markSeatmapSaved());
    } catch (error: unknown) {
      console.error(error);

      // Check for network errors
      const isNetworkError =
        !navigator.onLine ||
        (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) ||
        (error instanceof Error && error.message.toLowerCase().includes("network"));

      if (isNetworkError) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        const message = error instanceof Error ? error.message : "Failed to save seatmap";
        toast.error(message);
      }

      setIsSaving(false);
      setProgress(0);
      return;
    }

    setIsSaving(false);
  };

  return (
    <>
      <UploadProgress
        isOpen={isSaving}
        totalProgress={progress}
        files={files}
        onDone={() => {
          setIsSaving(false);
          setProgress(0);
        }}
        title={{
          loading: "Saving Seatmap Template",
          success: "Template Saved",
        }}
        description={{
          loading: "Uploading seatmap JSON to the template library...",
          success: "Your seatmap is now available in templates.",
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 md:gap-2"
        onClick={handleSave}
        disabled={isSaving}
      >
        <Save className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Save to Templates</span>
      </Button>
    </>
  );
}
