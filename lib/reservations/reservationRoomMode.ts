export type ReservationRoomMode = "online" | "walk_in";

type ReservationRoomModeConfig = {
  requiresScreenshotUpload: boolean;
  paymentTitle: string;
  paymentActionLabel: string;
  paymentConfirmationTitle: string;
  paymentConfirmationDescription: string;
  paymentConfirmationButtonLabel: string;
  finalConfirmationTitle: string | null;
  finalConfirmationDescription: string | null;
  finalConfirmationButtonLabel: string | null;
  paymentBadgeLabel: string;
  contactActionLabel: string;
};

export function getReservationRoomModeConfig(
  mode: ReservationRoomMode,
): ReservationRoomModeConfig {
  if (mode === "walk_in") {
    return {
      requiresScreenshotUpload: false,
      paymentTitle: "Confirm Walk-In Payment",
      paymentActionLabel: "Review Walk-In Sale",
      paymentConfirmationTitle: "Payment received?",
      paymentConfirmationDescription:
        "Confirm that the customer has already paid in person before reviewing the sale summary.",
      paymentConfirmationButtonLabel: "Yes, continue",
      finalConfirmationTitle: "Finalize walk-in sale?",
      finalConfirmationDescription:
        "Review the selected seats and total before capturing the final admin confirmation for this walk-in sale.",
      finalConfirmationButtonLabel: "Finalize walk-in sale",
      paymentBadgeLabel: "Walk-In Review",
      contactActionLabel: "Continue to Ticket Design",
    };
  }

  return {
    requiresScreenshotUpload: true,
    paymentTitle: "Upload GCash Payment",
    paymentActionLabel: "Submit Reservation",
    paymentConfirmationTitle: "Submit reservation?",
    paymentConfirmationDescription:
      "Please ensure all details are correct before submitting your reservation for verification.",
    paymentConfirmationButtonLabel: "Submit",
    finalConfirmationTitle: null,
    finalConfirmationDescription: null,
    finalConfirmationButtonLabel: null,
    paymentBadgeLabel: "Payment",
    contactActionLabel: "Continue to Ticket Design",
  };
}
