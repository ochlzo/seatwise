"use client";

import * as React from "react";
import Link from "next/link";
import type { SeatStatus } from "@prisma/client";
import { ImageUp, Loader2, ScanQrCode } from "lucide-react";

import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import type { SeatmapPreviewCategory } from "@/components/seatmap/CategoryAssignPanel";
import { TicketVerificationResult } from "@/components/tickets/TicketVerificationResult";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { normalizeScannedTicketToken } from "@/lib/tickets/qrPayload";
import type {
  TicketConsumeInvalidReason,
  TicketConsumeResult,
} from "@/lib/tickets/consumeIssuedTicket";
import type {
  TicketVerificationInvalidResult,
  TicketVerificationSuccessResult,
} from "@/lib/tickets/verifyIssuedTicket";
import type { VerifyScannedIssuedTicketResult } from "@/lib/tickets/verifyScannedIssuedTicket";

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
  schedId: string;
  seatmapId?: string | null;
  schedule: TicketScannerSchedulePreview;
};

type ScannerOutcome =
  | {
      kind: "readyToConsume";
      token: string;
      verification: TicketVerificationSuccessResult;
    }
  | {
      kind: "consumed";
      verification: TicketVerificationSuccessResult;
    }
  | {
      kind: "alreadyConsumed";
      verification: TicketVerificationSuccessResult;
    }
  | {
      kind: "invalid";
      reason: Exclude<TicketConsumeInvalidReason, "ALREADY_CONSUMED"> | string;
      verification: TicketVerificationInvalidResult;
    };

type CameraState =
  | "starting"
  | "ready"
  | "unsupported"
  | "unavailable"
  | "denied"
  | "paused"
  | "error";

function createInvalidResult(message: string): TicketVerificationInvalidResult {
  return {
    status: "INVALID",
    reason: "INVALID_TOKEN",
    message,
  };
}

function isInvalidVerificationResult(
  result: VerifyScannedIssuedTicketResult,
): result is Extract<VerifyScannedIssuedTicketResult, { status: "INVALID" }> {
  return result.status === "INVALID";
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
          "Camera access was denied. Allow camera access or use Scan From Image instead.",
      };
    }

    if (error.name === "NotFoundError") {
      return {
        state: "unavailable",
        message: "No camera was found on this device. Use Scan From Image instead.",
      };
    }
  }

  return {
    state: "error",
    message:
      error instanceof Error
        ? error.message
        : "The camera could not be started. Use Scan From Image instead.",
  };
}

function getScannerNotice(
  cameraState: CameraState,
  cameraMessage: string,
  scannerOutcome: ScannerOutcome | null,
) {
  if (cameraState !== "ready" && cameraState !== "paused") {
    return {
      tone: "warning" as const,
      message: cameraMessage,
    };
  }

  if (!scannerOutcome) {
    return {
      tone: "neutral" as const,
      message:
        cameraState === "paused"
          ? cameraMessage
          : "Scan a ticket or use Scan From Image to view the latest result.",
    };
  }

  if (scannerOutcome.kind === "readyToConsume") {
    return {
      tone: "success" as const,
      message: "Ticket ready to consume.",
    };
  }

  if (scannerOutcome.kind === "consumed") {
    return {
      tone: "success" as const,
      message: "E-ticket consumed successfully. Click continue to scan the next ticket.",
    };
  }

  if (scannerOutcome.kind === "alreadyConsumed") {
    return {
      tone: "warning" as const,
      message: "This ticket was already consumed. No data was changed.",
    };
  }

  return {
    tone: "destructive" as const,
    message: scannerOutcome.verification.message,
  };
}

export function AdminTicketScanner({
  showId,
  schedId,
  seatmapId,
  schedule,
}: AdminTicketScannerProps) {
  const isMobile = useIsMobile();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const scannerRef = React.useRef<{
    start: () => Promise<void>;
    stop: () => void;
    destroy: () => void;
  } | null>(null);
  const isProcessingRef = React.useRef(false);
  const lastScanRef = React.useRef<{ token: string; at: number } | null>(null);
  const [cameraState, setCameraState] = React.useState<CameraState>("starting");
  const [cameraMessage, setCameraMessage] = React.useState(
    "Starting the camera scanner.",
  );
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isConsuming, setIsConsuming] = React.useState(false);
  const [isScanningImage, setIsScanningImage] = React.useState(false);
  const [scannerOutcome, setScannerOutcome] = React.useState<ScannerOutcome | null>(
    null,
  );
  const [isSeatmapPreviewOpen, setIsSeatmapPreviewOpen] = React.useState(false);
  const [previewSchedule, setPreviewSchedule] = React.useState(schedule);
  const isBusy = isVerifying || isConsuming;

  const scannerNotice = React.useMemo(
    () => getScannerNotice(cameraState, cameraMessage, scannerOutcome),
    [cameraMessage, cameraState, scannerOutcome],
  );

  const pauseScanner = React.useEffectEvent(() => {
    scannerRef.current?.stop();
    setCameraState("paused");
    setCameraMessage("Scanner paused. Review the result before continuing.");
  });

  const resumeScanner = React.useEffectEvent(async () => {
    setScannerOutcome(null);

    if (!scannerRef.current) {
      return;
    }

    try {
      await scannerRef.current.start();
      setCameraState("ready");
      setCameraMessage("Camera ready.");
    } catch (error) {
      const nextError = getCameraErrorState(error);
      setCameraState(nextError.state);
      setCameraMessage(nextError.message);
    }
  });

  const applyConsumedSeatsToPreview = React.useEffectEvent((seatIds: string[]) => {
    setPreviewSchedule((currentSchedule) => ({
      ...currentSchedule,
      seatStatusById: seatIds.reduce<Record<string, SeatStatus>>(
        (nextStatusById, seatId) => {
          nextStatusById[seatId] = "CONSUMED";
          return nextStatusById;
        },
        { ...currentSchedule.seatStatusById },
      ),
    }));
  });

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
    if (scannerRef.current) {
      pauseScanner();
    }
    setIsVerifying(true);
    setScannerOutcome(null);

    try {
      const response = await fetch("/api/tickets/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: normalizedToken,
          showId,
          schedId,
        }),
      });

      const data = (await response.json()) as
        | VerifyScannedIssuedTicketResult
        | { error?: string };

      if (!response.ok || !("status" in data)) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Ticket verification failed.",
        );
      }

      const verificationResult = data as VerifyScannedIssuedTicketResult;

      if (verificationResult.status === "VALID") {
        setScannerOutcome({
          kind: "readyToConsume",
          token: normalizedToken,
          verification: verificationResult.verification,
        });
        return;
      }

      if (verificationResult.status === "CONSUMED") {
        setScannerOutcome({
          kind: "alreadyConsumed",
          verification: verificationResult.verification,
        });
        return;
      }

      if (isInvalidVerificationResult(verificationResult)) {
        setScannerOutcome({
          kind: "invalid",
          reason: verificationResult.reason,
          verification: verificationResult.verification,
        });
      }
    } catch (error) {
      setScannerOutcome({
        kind: "invalid",
        reason: "REQUEST_FAILED",
        verification: createInvalidResult(
          error instanceof Error
            ? error.message
            : "Ticket verification request failed.",
        ),
      });
    } finally {
      isProcessingRef.current = false;
      setIsVerifying(false);
    }
  });

  const handleConsumeTicket = React.useEffectEvent(async () => {
    if (scannerOutcome?.kind !== "readyToConsume") {
      return;
    }

    setIsConsuming(true);

    try {
      const response = await fetch("/api/tickets/consume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: scannerOutcome.token,
          showId,
          schedId,
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
        applyConsumedSeatsToPreview(data.seatIds);
        setScannerOutcome({
          kind: "consumed",
          verification: data.verification,
        });
        return;
      }

      if (data.reason === "ALREADY_CONSUMED") {
        setScannerOutcome({
          kind: "alreadyConsumed",
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
      setIsConsuming(false);
    }
  });

  const handleContinue = React.useEffectEvent(async () => {
    lastScanRef.current = null;
    await resumeScanner();
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
          "This browser does not support live camera scanning. Use Scan From Image instead.",
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
            "No camera was found on this device. Use Scan From Image instead.",
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
        setCameraMessage("Camera ready.");
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

  const handleImageUpload = React.useEffectEvent(
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
  );

  const resultActions = React.useMemo(() => {
    if (scannerOutcome?.kind === "readyToConsume") {
      return (
        <Button
          type="button"
          onClick={() => void handleConsumeTicket()}
          disabled={isBusy}
          className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {isConsuming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Consuming E-Ticket
            </>
          ) : (
            "Consume E-Ticket"
          )}
        </Button>
      );
    }

    if (!scannerOutcome) {
      return null;
    }

    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleContinue()}
        disabled={isBusy}
        className="w-full"
      >
        Continue
      </Button>
    );
  }, [isBusy, isConsuming, scannerOutcome]);

  const showMobileResultOverlay =
    isMobile === true &&
    cameraState === "paused" &&
    !isBusy &&
    !!scannerOutcome &&
    scannerOutcome.kind !== "readyToConsume";

  const scanFromImageButton = (
    <Button
      type="button"
      variant="outline"
      asChild
      disabled={isScanningImage || isBusy || cameraState === "paused"}
      className="w-full justify-center md:w-auto md:justify-self-end"
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
  );

  const seatmapPreviewContent = seatmapId ? (
    <SeatmapPreview
      seatmapId={seatmapId}
      categories={previewSchedule.seatmapCategories}
      seatCategories={previewSchedule.seatCategoryAssignments}
      seatStatusById={previewSchedule.seatStatusById}
      showReservationOverlay
      heightClassName="h-[22rem] md:h-[28rem] lg:h-[32rem]"
    />
  ) : (
    <div className="rounded-lg border border-dashed border-sidebar-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
      Seatmap preview is unavailable for this show.
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <Button variant="outline" asChild className="min-w-0 flex-1 justify-center">
          <Link href={`/admin/shows/${showId}`}>Back To Show</Link>
        </Button>
        <div className="flex-1">{scanFromImageButton}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <Card className="gap-0 border-sidebar-border">
          <CardHeader className="hidden grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-4 md:grid">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanQrCode className="h-4 w-4 text-primary" />
              Scanner
            </CardTitle>
            {scanFromImageButton}
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-2 md:p-6 md:pt-0">
            <div className="px-2 md:hidden">
              <p className="text-sm font-medium text-foreground">{previewSchedule.label}</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-zinc-950">
              <div className="relative aspect-[380/340] min-h-[21rem] md:aspect-[4/3] md:min-h-[18rem] lg:min-h-[25rem]">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />
                <div className="pointer-events-none absolute inset-0 border-[10px] border-white/10" />
                {(cameraState === "starting" || isBusy) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isConsuming
                        ? "Consuming ticket"
                        : isVerifying
                          ? "Checking ticket"
                          : "Starting camera"}
                    </div>
                  </div>
                )}
                {cameraState === "paused" && !isBusy ? (
                  <div className="absolute inset-0 z-10 bg-black/50">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 px-4 py-2 text-center text-sm text-white">
                      Scanner paused
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {showMobileResultOverlay ? (
          <Card className="border-sidebar-border md:hidden">
            <CardContent className="flex min-h-[22.75rem] items-center justify-center p-5">
              <div className="w-full max-w-[19rem] rounded-2xl bg-muted px-5 py-6 shadow-sm">
                <p className="text-center text-sm leading-6 text-foreground">
                  {scannerNotice.message}
                </p>
                {resultActions ? (
                  <div className="mt-4 ml-auto w-full max-w-[9rem]">{resultActions}</div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : (
          <TicketVerificationResult
            result={scannerOutcome?.verification ?? null}
            loading={isBusy}
            title="Scan Result"
            description={
              scannerOutcome?.kind === "readyToConsume"
                ? "This e-ticket is valid and ready for manual consume."
                : "Latest verification details."
            }
            emptyMessage="Scan a ticket to view its details."
            notice={scannerNotice}
            actions={resultActions}
            className="h-full border-sidebar-border"
          />
        )}

        <Card className="hidden gap-0 border-sidebar-border md:block lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Seatmap Preview</CardTitle>
            <CardDescription>{previewSchedule.label}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">{seatmapPreviewContent}</CardContent>
        </Card>
      </div>

      <Dialog open={isSeatmapPreviewOpen} onOpenChange={setIsSeatmapPreviewOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="ml-auto w-full max-w-[16rem] md:hidden"
          >
            View Seatmap Preview
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[calc(100%-1rem)] max-w-[25rem] rounded-2xl p-4 sm:max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle>Seatmap Preview</DialogTitle>
            <DialogDescription>{previewSchedule.label}</DialogDescription>
          </DialogHeader>
          {seatmapPreviewContent}
        </DialogContent>
      </Dialog>
    </div>
  );
}
