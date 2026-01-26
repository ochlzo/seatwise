"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UploadProgress } from "@/components/ui/upload-progress";
import { saveSeatmapTemplateAction } from "@/lib/actions/saveSeatmapTemplate";
import { calculateFitViewport } from "@/lib/seatmap/view-utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SeatmapSaveTemplateButton() {
  const seatmap = useAppSelector((state) => state.seatmap);
  const searchParams = useSearchParams();
  const seatmapId = searchParams.get("seatmapId") ?? undefined;
  const [isSaving, setIsSaving] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [files, setFiles] = React.useState<{ name: string; size: number }[]>([]);
  const [isCategoryWarningOpen, setIsCategoryWarningOpen] = React.useState(false);

  const hasUnassignedSeats = React.useMemo(() => {
    return Object.values(seatmap.nodes).some((node) => {
      return node.type === "seat" && !("categoryId" in node && node.categoryId);
    });
  }, [seatmap.nodes]);

  const handleSave = async () => {
    const name = seatmap.title?.trim();
    if (!name) {
      toast.error("Seatmap name is required.");
      return;
    }
    if (hasUnassignedSeats) {
      setIsCategoryWarningOpen(true);
      return;
    }

    setIsSaving(true);
    setProgress(0);

    const exportData = {
      title: seatmap.title,
      nodes: seatmap.nodes,
      categories: seatmap.categories,
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
        categories: seatmap.categories.map((category) => ({
          seat_category_id: category.id,
          category_name: category.name,
          price: category.price,
        })),
        seatmap_id: seatmapId,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to save seatmap");
      }

      currentProgress = 100;
      setProgress(currentProgress);
      toast.success(seatmapId ? "Seatmap updated." : "Seatmap saved to templates.");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to save seatmap");
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
      <Dialog open={isCategoryWarningOpen} onOpenChange={setIsCategoryWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassigned Seats Detected</DialogTitle>
            <DialogDescription>
              Some seats do not have a category yet. Assign categories before saving to templates. (e.g., Regular).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button onClick={() => setIsCategoryWarningOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
