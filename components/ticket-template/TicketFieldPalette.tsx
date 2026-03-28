"use client";

import * as React from "react";
import Link from "next/link";
import { ImagePlus, Layers2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import {
  TICKET_TEMPLATE_FIELD_OPTIONS,
  addAssetNode,
  addFieldNode,
  addQrNode,
} from "@/lib/features/ticketTemplate/ticketTemplateSlice";
import { useAppDispatch } from "@/lib/hooks";
import { cn } from "@/lib/utils";

async function readPngFile(file: File) {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Unable to read ${file.name}`));
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error(`Unable to load ${file.name}`));
    nextImage.src = src;
  });

  return {
    src,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export function TicketFieldPalette() {
  const dispatch = useAppDispatch();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAssetUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== "image/png") {
      toast.error("Only PNG ticket assets are supported.");
      event.target.value = "";
      return;
    }

    try {
      const asset = await readPngFile(file);
      dispatch(
        addAssetNode({
          src: asset.src,
          width: asset.width,
          height: asset.height,
          name: file.name,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to import the PNG asset.";
      toast.error(message);
    }

    event.target.value = "";
  };

  return (
    <Card className="gap-4 border-zinc-200/80 bg-white/90 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers2 className="h-4 w-4 text-blue-600" />
          Ticket Elements
        </CardTitle>
        <CardDescription>
          Add PNG artwork, dynamic fields, and the fixed QR surface.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          onChange={handleAssetUpload}
          className="hidden"
        />

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            Artwork
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="mr-2 h-4 w-4 text-blue-600" />
            Upload PNG Asset
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            Reservation Fields
          </div>
          <div className="grid gap-2">
            {TICKET_TEMPLATE_FIELD_OPTIONS.map((field) => (
              <Button
                key={field.key}
                type="button"
                variant="ghost"
                className={cn(
                  "justify-between rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                )}
                onClick={() => dispatch(addFieldNode({ fieldKey: field.key }))}
              >
                <span>{field.label}</span>
                <span className="text-xs text-zinc-400">Add</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            Secure Code
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => dispatch(addQrNode(undefined))}
          >
            <QrCode className="mr-2 h-4 w-4 text-emerald-600" />
            Add QR Block
          </Button>
        </div>

        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/70 p-3 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
          Create and manage saved templates from{" "}
          <Link
            href="/admin/ticket-templates"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            the admin template list
          </Link>
          . Field nodes always stay above uploaded artwork on the exported ticket.
        </div>
      </CardContent>
    </Card>
  );
}
