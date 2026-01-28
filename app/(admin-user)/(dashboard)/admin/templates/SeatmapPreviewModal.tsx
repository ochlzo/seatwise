"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import { ExternalLink } from "lucide-react";

type SeatmapPreviewModalProps = {
    seatmapId: string;
    seatmapName: string;
};

export function SeatmapPreviewModal({ seatmapId, seatmapName }: SeatmapPreviewModalProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Preview
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[95vw]">
                <DialogHeader>
                    <DialogTitle>{seatmapName}</DialogTitle>
                </DialogHeader>
                <SeatmapPreview
                    seatmapId={seatmapId}
                    heightClassName="h-[60vh]"
                    allowMarqueeSelection={false}
                    allowCategoryAssign={false}
                />
            </DialogContent>
        </Dialog>
    );
}
