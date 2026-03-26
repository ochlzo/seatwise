export type AdminPaymentDisplay = {
  kind: "proof_of_payment" | "walk_in_receipt";
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
  panelTitle: "Proof Of Payment",
  emptyStateLabel: "No payment image uploaded.",
  downloadLabel: "Download proof of payment image",
  openLabel: "Open proof image",
  imageAlt: (customerName) => `Payment proof for ${customerName}`,
  expandedImageAlt: (customerName) => `Expanded proof of payment for ${customerName}`,
});

const buildWalkInDisplay = (): AdminPaymentDisplay => ({
  kind: "walk_in_receipt",
  cardTagLabel: "Walk-In",
  panelTitle: "Walk-In Receipt",
  emptyStateLabel: "No walk-in receipt uploaded.",
  downloadLabel: "Download walk-in receipt image",
  openLabel: "Open receipt image",
  imageAlt: (customerName) => `Walk-in receipt for ${customerName}`,
  expandedImageAlt: (customerName) => `Expanded walk-in receipt for ${customerName}`,
});

export const getAdminPaymentDisplay = (method: string | null | undefined): AdminPaymentDisplay =>
  method === "WALK_IN" ? buildWalkInDisplay() : buildProofDisplay();
