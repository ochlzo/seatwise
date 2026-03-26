export type CompletionMode = "online" | "walk_in";

export type CompletionPaymentRecord = {
  method: "GCASH" | "WALK_IN";
  status: "PENDING" | "PAID";
  screenshot_url: string | null;
  paid_at: Date | null;
};

export const buildCompletionPaymentRecord = ({
  mode,
  assetUrl,
  paidAt,
}: {
  mode: CompletionMode;
  assetUrl: string | null;
  paidAt?: Date | null;
}): CompletionPaymentRecord =>
  mode === "walk_in"
    ? {
        method: "WALK_IN",
        status: "PAID",
        screenshot_url: assetUrl,
        paid_at: paidAt ?? null,
      }
    : {
        method: "GCASH",
        status: "PENDING",
        screenshot_url: assetUrl,
        paid_at: null,
      };
