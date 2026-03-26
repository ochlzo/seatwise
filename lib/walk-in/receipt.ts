const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const formatDateTime = (value: Date) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);

export type WalkInReceiptPayload = {
  reservationNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhoneNumber?: string;
  showName: string;
  venue?: string;
  scheduleLabel: string;
  seatNumbers: string[];
  totalAmount: number;
  issuedAt?: Date;
  title?: string;
  headline?: string;
  paymentMethodLabel?: string;
};

export const buildWalkInReceiptSvg = (payload: WalkInReceiptPayload) => {
  const issuedAt = payload.issuedAt ?? new Date();
  const seatLines = payload.seatNumbers.map((seat, index) => {
    const row = 436 + index * 28;
    return `<text x="72" y="${row}" font-size="18" font-family="'Segoe UI', Arial, sans-serif" fill="#1f2937">${escapeXml(seat)}</text>`;
  });
  const customerEmailLine = payload.customerEmail
    ? `<text x="104" y="466" font-size="18" font-family="'Segoe UI', Arial, sans-serif" fill="#4b5563">${escapeXml(payload.customerEmail)}</text>`
    : "";
  const customerPhoneLine = payload.customerPhoneNumber
    ? `<text x="104" y="496" font-size="18" font-family="'Segoe UI', Arial, sans-serif" fill="#4b5563">${escapeXml(payload.customerPhoneNumber)}</text>`
    : "";
  const receiptTitle = payload.title ?? "Seatwise Walk-In Receipt";
  const headline = payload.headline ?? "Bought in person";
  const paymentMethodLabel = payload.paymentMethodLabel ?? "Method: WALK_IN";
  const venueLabel = payload.venue ?? payload.showName;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="760" viewBox="0 0 1200 760" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="760" rx="32" fill="#f7f3ea"/>
  <rect x="40" y="40" width="1120" height="680" rx="28" fill="#fffdf9" stroke="#e7ddcb" stroke-width="2"/>
  <rect x="72" y="72" width="1056" height="112" rx="24" fill="#111827"/>
  <text x="104" y="124" font-size="22" font-family="'Segoe UI', Arial, sans-serif" fill="#f6e7b5">${escapeXml(receiptTitle)}</text>
  <text x="104" y="160" font-size="36" font-weight="700" font-family="'Segoe UI', Arial, sans-serif" fill="#ffffff">${escapeXml(payload.showName)}</text>
  <text x="842" y="124" font-size="18" font-family="'Segoe UI', Arial, sans-serif" fill="#d1d5db">Reservation No.</text>
  <text x="842" y="160" font-size="34" font-weight="700" font-family="'Segoe UI', Arial, sans-serif" fill="#ffffff">#${escapeXml(payload.reservationNumber)}</text>

  <text x="72" y="242" font-size="16" letter-spacing="1.6" font-family="'Segoe UI', Arial, sans-serif" fill="#92400e">PURCHASE DETAILS</text>
  <text x="72" y="282" font-size="24" font-weight="700" font-family="'Segoe UI', Arial, sans-serif" fill="#111827">${escapeXml(headline)}</text>
  <text x="72" y="314" font-size="18" font-family="'Segoe UI', Arial, sans-serif" fill="#4b5563">Issued ${escapeXml(formatDateTime(issuedAt))}</text>

  <rect x="72" y="348" width="508" height="316" rx="24" fill="#f9fafb" stroke="#e5e7eb"/>
  <text x="104" y="392" font-size="16" letter-spacing="1.6" font-family="'Segoe UI', Arial, sans-serif" fill="#6b7280">CUSTOMER</text>
  <text x="104" y="430" font-size="26" font-weight="700" font-family="'Segoe UI', Arial, sans-serif" fill="#111827">${escapeXml(payload.customerName)}</text>
  ${customerEmailLine}
  ${customerPhoneLine}
  <text x="104" y="544" font-size="16" letter-spacing="1.6" font-family="'Segoe UI', Arial, sans-serif" fill="#6b7280">SEATS</text>
  ${seatLines.join("\n  ")}

  <rect x="620" y="348" width="508" height="316" rx="24" fill="#fffbeb" stroke="#f59e0b"/>
  <text x="652" y="392" font-size="16" letter-spacing="1.6" font-family="'Segoe UI', Arial, sans-serif" fill="#92400e">EVENT</text>
  <text x="652" y="430" font-size="24" font-weight="700" font-family="'Segoe UI', Arial, sans-serif" fill="#111827">${escapeXml(venueLabel)}</text>
  <text x="652" y="470" font-size="18" font-family="'Segoe UI', Arial, sans-serif" fill="#4b5563">${escapeXml(payload.scheduleLabel)}</text>
  <text x="652" y="544" font-size="16" letter-spacing="1.6" font-family="'Segoe UI', Arial, sans-serif" fill="#92400e">PAYMENT</text>
  <text x="652" y="586" font-size="22" font-weight="700" font-family="'Segoe UI', Arial, sans-serif" fill="#111827">${escapeXml(paymentMethodLabel)}</text>
  <text x="652" y="626" font-size="42" font-weight="700" font-family="'Segoe UI', Arial, sans-serif" fill="#92400e">${escapeXml(formatCurrency(payload.totalAmount))}</text>
</svg>`;
};

export const buildWalkInReceiptUploadDataUri = (payload: WalkInReceiptPayload) =>
  `data:image/svg+xml;base64,${Buffer.from(buildWalkInReceiptSvg(payload)).toString("base64")}`;

export const buildWalkInReceiptAttachment = (payload: WalkInReceiptPayload) => {
  const svg = buildWalkInReceiptSvg(payload);

  return {
    filename: `seatwise-walk-in-${payload.reservationNumber}.svg`,
    mimeType: "image/svg+xml",
    content: Buffer.from(svg, "utf8"),
  };
};
