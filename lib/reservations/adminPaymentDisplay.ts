export type AdminPaymentDisplay = {
  kind: "proof_of_payment";
  cardTagLabel: string | null;
  panelTitle: string;
  emptyStateLabel: string;
  downloadLabel: string;
  openLabel: string;
  imageAlt: (customerName: string) => string;
  expandedImageAlt: (customerName: string) => string;
};

const buildProofDisplay = (): AdminPaymentDisplay => ({
  kind: "proof_of_payment",
  cardTagLabel: null,
  panelTitle: "Payment Proof",
  emptyStateLabel: "No uploaded payment proof.",
  downloadLabel: "Download uploaded payment proof image",
  openLabel: "Open uploaded proof image",
  imageAlt: (customerName) => `Payment proof for ${customerName}`,
  expandedImageAlt: (customerName) => `Expanded proof of payment for ${customerName}`,
});

const buildWalkInDisplay = (): AdminPaymentDisplay => ({
  kind: "proof_of_payment",
  cardTagLabel: "Walk-In",
  panelTitle: "Payment Proof",
  emptyStateLabel: "No uploaded payment proof for this walk-in payment.",
  downloadLabel: "Download uploaded payment proof image",
  openLabel: "Open uploaded proof image",
  imageAlt: (customerName) => `Uploaded payment proof for walk-in payment for ${customerName}`,
  expandedImageAlt: (customerName) =>
    `Expanded uploaded payment proof for walk-in payment for ${customerName}`,
});

export const getAdminPaymentDisplay = (method: string | null | undefined): AdminPaymentDisplay =>
  method === "WALK_IN" ? buildWalkInDisplay() : buildProofDisplay();
