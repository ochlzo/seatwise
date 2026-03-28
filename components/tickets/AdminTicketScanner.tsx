"use client";

import * as React from "react";
import type { SeatStatus } from "@prisma/client";
import { Camera, ImageUp, Loader2, ScanQrCode, ShieldAlert } from "lucide-react";

import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import type { SeatmapPreviewCategory } from "@/components/seatmap/CategoryAssignPanel";
import { TicketVerificationResult } from "@/components/tickets/TicketVerificationResult";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TicketConsumeResult } from "@/lib/tickets/consumeIssuedTicket";
import { normalizeScannedTicketToken } from "@/lib/tickets/qrPayload";
import type { TicketVerificationResult as TicketVerificationResultData } from "@/lib/tickets/verifyIssuedTicket";

export type TicketScannerSchedulePreview = {
  schedId: string;
  label: string;
  seatmapCategories: Array<
    SeatmapPreviewCategory & {
      price: string;
    }
  >;
  seatCategoryAssignments: Record<string, string>;
  seatStatusById: Record<string, SeatStatus>;
};

type AdminTicketScannerProps = {
  showId: string;
  showName: string;
  seatmapId?: string | null;
  schedules: TicketScannerSchedulePreview[];
};

type ScannerOutcome =
  | {
      kind: "success";
      reason: null;
      verification: TicketVerificationResultData;
    }
  | {
      kind: "invalid";
      reason: string;
      verification: TicketVerificationResultData;
    };

type CameraState =
  | "starting"
  | "ready"
  | "unsupported"
  | "unavailable"
  | "denied"
  | "error";

function createInvalidResult(message: string): TicketVerificationResultData {
  return {
    status: "INVALID",
    reason: "INVALID_TOKEN",
    message,
  };
}

function getCameraErrorState(error: unknown): {
  state: CameraState;
  message: string;
} {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return {
        state: "denied",
        message:
          "Camera access was denied. Allow camera access or use the image upload fallback.",
      };
    }

    if (error.name === "NotFoundError") {
      return {
        state: "unavailable",
        message: "No camera was found on this device. Use the image upload fallback.",
      };
    }
  }

  return {
    state: "error",
    message:
      error instanceof Error
        ? error.message
        : "The camera could not be started. Use the image upload fallback.",
  };
}

export function AdminTicketScanner({
  showId,
  showName,
  seatmapId,
  schedules,
}: AdminTicketScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const scannerRef = React.useRef<{
    destroy: () => void;
  } | null>(null);
  const isProcessingRef = React.useRef(false);
  const lastScanRef = React.useRef<{ token: string; at: number } | null>(null);
  const [cameraState, setCameraState] = React.useState<CameraState>("starting");
  const [cameraMessage, setCameraMessage] = React.useState(
    "Starting the rear camera scanner.",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isScanningImage, setIsScanningImage] = React.useState(false);
  const [lastToken, setLastToken] = React.useState<string | null>(null);
  const [scannerOutcome, setScannerOutcome] = React.useState<ScannerOutcome | null>(
    null,
  );
  const [previewSchedules, setPreviewSchedules] = React.useState(schedules);
  const [activeSchedId, setActiveSchedId] = React.useState(
    schedules[0]?.schedId ?? "",
  );

  const activeSchedule = React.useMemo(
    () =>
      previewSchedules.find((schedule) => schedule.schedId === activeSchedId) ??
      previewSchedules[0] ??
      null,
    [activeSchedId, previewSchedules],
  );

  const applyConsumedSeatsToPreview = React.useEffectEvent(
    (schedId: string, seatIds: string[]) => {
      setActiveSchedId(schedId);
      setPreviewSchedules((currentSchedules) =>
        currentSchedules.map((schedule) =>
          schedule.schedId !== schedId
            ? schedule
            : {
                ...schedule,
                seatStatusById: seatIds.reduce<Record<string, SeatStatus>>(
                  (nextStatusById, seatId) => {
                    nextStatusById[seatId] = "CONSUMED";
                    return nextStatusById;
                  },
                  { ...schedule.seatStatusById },
                ),
              },
        ),
      );
    },
  );

  const processToken = React.useEffectEvent(async (token: string) => {
    const normalizedToken = normalizeScannedTicketToken(token);
    if (!normalizedToken) return;

    const now = Date.now();
    const lastScan = lastScanRef.current;
    if (
      isProcessingRef.current ||
      (lastScan &&
        lastScan.token === normalizedToken &&
        now - lastScan.at < 1200)
    ) {
      return;
    }

    isProcessingRef.current = true;
    lastScanRef.current = { token: normalizedToken, at: now };
    setIsSubmitting(true);
    setLastToken(normalizedToken);
    setScannerOutcome(null);

    try {
      const response = await fetch("/api/tickets/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: normalizedToken,
          showId,
        }),
      });

      const data = (await response.json()) as
        | TicketConsumeResult
        | { error?: string };

      if (!response.ok || !("status" in data)) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Ticket consume failed.",
        );
      }

      if (data.status === "CONSUMED") {
        applyConsumedSeatsToPreview(data.schedId, data.seatIds);
        setScannerOutcome({
          kind: "success",
          reason: null,
          verification: data.verification,
        });
        return;
      }

      setScannerOutcome({
        kind: "invalid",
        reason: data.reason,
        verification: data.verification,
      });
    } catch (error) {
      setScannerOutcome({
        kind: "invalid",
        reason: "REQUEST_FAILED",
        verification: createInvalidResult(
          error instanceof Error
            ? error.message
            : "Ticket consume request failed.",
        ),
      });
    } finally {
      isProcessingRef.current = false;
      setIsSubmitting(false);
    }
  });

  React.useEffect(() => {
    let isDisposed = false;

    const startScanner = async () => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraState("unsupported");
        setCameraMessage(
          "This browser does not support live camera scanning. Use the image upload fallback.",
        );
        return;
      }

      try {
        const qrScannerModule = await import("qr-scanner");
        const QrScanner = qrScannerModule.default;
        const hasCamera = await QrScanner.hasCamera();

        if (isDisposed) return;

        if (!hasCamera) {
          setCameraState("unavailable");
          setCameraMessage(
            "No camera was found on this device. Use the image upload fallback.",
          );
          return;
        }

        const scanner = new QrScanner(
          videoElement,
          (result) => {
            void processToken(result.data);
          },
          {
            preferredCamera: "environment",
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
            onDecodeError: () => {
              // Expected while waiting for a visible QR code.
            },
          },
        );

        scannerRef.current = scanner;
        await scanner.start();

        if (isDisposed) {
          scanner.destroy();
          return;
        }

        setCameraState("ready");
        setCameraMessage(
          "Rear camera is active. Point it at a Seatwise ticket QR code.",
        );
      } catch (error) {
        if (isDisposed) return;

        const nextError = getCameraErrorState(error);
        setCameraState(nextError.state);
        setCameraMessage(nextError.message);
      }
    };

    void startScanner();

    return () => {
      isDisposed = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  const handleImageUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      setIsScanningImage(true);

      try {
        const qrScannerModule = await import("qr-scanner");
        const result = await qrScannerModule.default.scanImage(file, {
          returnDetailedScanResult: true,
        });

        await processToken(result.data);
      } catch (error) {
        setScannerOutcome({
          kind: "invalid",
          reason: "IMAGE_SCAN_FAILED",
          verification: createInvalidResult(
            error instanceof Error
              ? error.message
              : "No QR code could be read from the selected image.",
          ),
        });
      } finally {
        setIsScanningImage(false);
      }
    },
    [],
  );

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className="border-sidebar-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanQrCode className="h-4 w-4 text-primary" />
            Live Ticket Scanner
          </CardTitle>
          <CardDescription>
            {showName}
            {" "}
            ticket checks are door-staff scoped to this show.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-zinc-950">
            <div className="relative aspect-[4/3] min-h-[18rem]">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              <div className="pointer-events-none absolute inset-0 border-[10px] border-white/10" />
              <div className="pointer-events-none absolute inset-x-6 top-6 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-center text-xs font-medium tracking-[0.2em] text-white/90 uppercase">
                Rear Camera Preferred
              </div>
              {(cameraState === "starting" || isSubmitting) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isSubmitting ? "Checking ticket" : "Starting camera"}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              cameraState === "ready"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            <div className="flex items-start gap-2">
              {cameraState === "ready" ? (
                <Camera className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p>{cameraMessage}</p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-sidebar-border/70 bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Fallback Image Scan</p>
                <p className="text-sm text-muted-foreground">
                  Upload a QR screenshot or photo if camera access is unavailable.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={isScanningImage}
              >
                <label className="cursor-pointer">
                  {isScanningImage ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageUp className="mr-2 h-4 w-4" />
                  )}
                  Scan From Image
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </Button>
            </div>
          </div>

          {lastToken ? (
            <div className="rounded-lg border border-sidebar-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              Last scanned token:
              {" "}
              <span className="font-mono">{`${lastToken.slice(0, 18)}...`}</span>
            </div>
          ) : null}

          {scannerOutcome?.kind === "invalid" &&
          scannerOutcome.reason === "ALREADY_CONSUMED" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This ticket was already consumed. No data was changed.
            </div>
          ) : null}

          <TicketVerificationResult
            result={scannerOutcome?.verification ?? null}
            loading={isSubmitting}
            title="Latest Scan Result"
            description="Fresh scans consume the ticket. Re-scans return an explicit already-consumed result."
          />
        </CardContent>
      </Card>

      <Card className="border-sidebar-border">
        <CardHeader>
          <CardTitle className="text-base">Seatmap Preview</CardTitle>
          <CardDescription>
            Successful consumes update the affected seats in the schedule preview
            immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewSchedules.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {previewSchedules.map((schedule) => (
                <Button
                  key={schedule.schedId}
                  type="button"
                  variant={
                    schedule.schedId === activeSchedule?.schedId
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => setActiveSchedId(schedule.schedId)}
                >
                  {schedule.label}
                </Button>
              ))}
            </div>
          ) : null}

          {activeSchedule && seatmapId ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{activeSchedule.label}</p>
              <SeatmapPreview
                seatmapId={seatmapId}
                categories={activeSchedule.seatmapCategories}
                seatCategories={activeSchedule.seatCategoryAssignments}
                seatStatusById={activeSchedule.seatStatusById}
                showReservationOverlay
                heightClassName="h-[360px]"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-sidebar-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              Seatmap preview is unavailable for this show.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
