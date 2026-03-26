type EmailImageAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

type ReservationSubmittedEmailPayload = {
  to: string;
  customerName: string;
  reservationNumber: string;
  showName: string;
  scheduleLabel: string;
  seatNumbers: string[];
  totalAmount: string;
  proofImageUrl?: string | null;
};

type WalkInReceiptEmailPayload = {
  to: string;
  customerName: string;
  reservationNumber: string;
  showName: string;
  scheduleLabel: string;
  seatNumbers: string[];
  totalAmount: string;
  receiptImageUrl: string;
};

type ReservationStatusEmailLineItem = {
  reservationNumber: string;
  showName: string;
  venue?: string;
  scheduleLabel: string;
  seatNumbers: string[];
  amount: string;
  paymentMethod?: string | null;
  proofImageUrl?: string | null;
};

type ReservationStatusUpdateEmailPayload = {
  to: string;
  customerName: string;
  targetStatus: "CONFIRMED" | "CANCELLED";
  lineItems: ReservationStatusEmailLineItem[];
};

const CRLF = "\r\n";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const encodeAttachmentBody = (content: Buffer) =>
  content.toString("base64").replace(/(.{76})/g, "$1\r\n");

const buildReservationSummary = (lineItems: ReservationStatusEmailLineItem[]) =>
  lineItems
    .map((item, index) =>
      [
        `${index + 1}. ${item.showName}`,
        `   Reservation No: ${item.reservationNumber}`,
        `   Schedule: ${item.scheduleLabel}`,
        `   Seats: ${item.seatNumbers.join(", ")}`,
        `   Amount: ${item.amount}`,
      ].join(CRLF),
    )
    .join(`${CRLF}${CRLF}`);

export const buildReservationSubmittedEmailMessage = ({
  sender,
  payload,
  proofAttachment,
}: {
  sender: string;
  payload: ReservationSubmittedEmailPayload;
  proofAttachment: EmailImageAttachment | null;
}) => {
  const htmlBody = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#111827;line-height:1.6">
      <p>Hi ${escapeHtml(payload.customerName)},</p>
      <p>We received your reservation request in Seatwise.</p>
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f9fafb">
        <p><strong>Reservation Number:</strong> ${escapeHtml(payload.reservationNumber)}</p>
        <p><strong>Show:</strong> ${escapeHtml(payload.showName)}</p>
        <p><strong>Schedule:</strong> ${escapeHtml(payload.scheduleLabel)}</p>
        <p><strong>Seats:</strong> ${escapeHtml(payload.seatNumbers.join(", "))}</p>
        <p><strong>Total:</strong> ${escapeHtml(payload.totalAmount)}</p>
        <p><strong>Status:</strong> UNDER REVIEW / VERIFICATION</p>
      </div>
      ${
        payload.proofImageUrl
          ? `<p style="margin-top:20px">Your uploaded GCash proof is shown below while the reservation is pending approval.</p>
             <img src="${escapeHtml(payload.proofImageUrl)}" alt="GCash proof of payment" style="display:block;max-width:100%;border-radius:16px;border:1px solid #d1d5db" />
             <p style="margin-top:12px;color:#4b5563">The same proof image is also attached as a downloadable file.</p>`
          : "<p>Your reservation will be reviewed by the admin team. You will receive an update after verification.</p>"
      }
      <p style="margin-top:20px">Thank you,<br />Seatwise Team</p>
    </div>
  `.trim();

  const textBody = [
    `Hi ${payload.customerName},`,
    "",
    "We received your reservation request in Seatwise.",
    "",
    `Reservation Number: ${payload.reservationNumber}`,
    `Show: ${payload.showName}`,
    `Schedule: ${payload.scheduleLabel}`,
    `Seats: ${payload.seatNumbers.join(", ")}`,
    `Total: ${payload.totalAmount}`,
    "",
    "Status: UNDER REVIEW / VERIFICATION",
    "",
    payload.proofImageUrl
      ? `GCash proof image: ${payload.proofImageUrl}`
      : "Your reservation will be reviewed by the admin team. You will receive an update after verification.",
    "",
    "Thank you,",
    "Seatwise Team",
  ].join(CRLF);

  const mixedBoundary = `seatwise-submission-mixed-${payload.reservationNumber}`;
  const alternativeBoundary = `seatwise-submission-alt-${payload.reservationNumber}`;
  const rawParts = [
    `From: Seatwise <${sender}>`,
    `To: ${payload.to}`,
    `Subject: Seatwise Reservation Received - ${payload.showName}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    textBody,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
    "",
    `--${alternativeBoundary}--`,
  ];

  if (proofAttachment) {
    rawParts.push(
      "",
      `--${mixedBoundary}`,
      `Content-Type: ${proofAttachment.contentType}; name="${proofAttachment.filename}"`,
      `Content-Disposition: attachment; filename="${proofAttachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      encodeAttachmentBody(proofAttachment.content),
    );
  }

  rawParts.push("", `--${mixedBoundary}--`);
  return rawParts.join(CRLF);
};

export const buildWalkInReceiptEmailMessage = ({
  sender,
  payload,
  receiptAttachment,
}: {
  sender: string;
  payload: WalkInReceiptEmailPayload;
  receiptAttachment: EmailImageAttachment;
}) => {
  const textBody = [
    `Hi ${payload.customerName},`,
    "",
    "Thank you for your in-person purchase through Seatwise.",
    "",
    `Reservation Number: ${payload.reservationNumber}`,
    `Show: ${payload.showName}`,
    `Schedule: ${payload.scheduleLabel}`,
    `Seats: ${payload.seatNumbers.join(", ")}`,
    `Total Paid: ${payload.totalAmount}`,
    "",
    "This ticket purchase was completed as a walk-in / bought in person transaction.",
    `Receipt image: ${payload.receiptImageUrl}`,
    "",
    "Thank you,",
    "Seatwise Team",
  ].join(CRLF);

  const htmlBody = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#111827;line-height:1.6">
      <p>Hi ${escapeHtml(payload.customerName)},</p>
      <p>Thank you for your in-person purchase through Seatwise.</p>
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f9fafb">
        <p><strong>Reservation Number:</strong> ${escapeHtml(payload.reservationNumber)}</p>
        <p><strong>Show:</strong> ${escapeHtml(payload.showName)}</p>
        <p><strong>Schedule:</strong> ${escapeHtml(payload.scheduleLabel)}</p>
        <p><strong>Seats:</strong> ${escapeHtml(payload.seatNumbers.join(", "))}</p>
        <p><strong>Total Paid:</strong> ${escapeHtml(payload.totalAmount)}</p>
        <p><strong>Purchase Type:</strong> Walk-in / bought in person</p>
      </div>
      <p style="margin-top:20px">Your receipt image is shown below for reference. The same image is also attached as a downloadable file.</p>
      <img src="${escapeHtml(payload.receiptImageUrl)}" alt="Walk-in receipt" style="display:block;max-width:100%;border-radius:16px;border:1px solid #d1d5db" />
      <p style="margin-top:20px">Thank you,<br />Seatwise Team</p>
    </div>
  `.trim();

  const mixedBoundary = `seatwise-walk-in-mixed-${payload.reservationNumber}`;
  const alternativeBoundary = `seatwise-walk-in-alt-${payload.reservationNumber}`;

  return [
    `From: Seatwise <${sender}>`,
    `To: ${payload.to}`,
    `Subject: Seatwise Walk-In Receipt - ${payload.showName}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    textBody,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
    "",
    `--${alternativeBoundary}--`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: ${receiptAttachment.contentType}; name="${receiptAttachment.filename}"`,
    `Content-Disposition: attachment; filename="${receiptAttachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    encodeAttachmentBody(receiptAttachment.content),
    "",
    `--${mixedBoundary}--`,
  ].join(CRLF);
};

export const buildReservationStatusUpdateEmailMessage = ({
  sender,
  payload,
  receiptImageUrls,
  receiptAttachments,
}: {
  sender: string;
  payload: ReservationStatusUpdateEmailPayload;
  receiptImageUrls: string[];
  receiptAttachments: EmailImageAttachment[];
}) => {
  const isConfirmed = payload.targetStatus === "CONFIRMED";
  const statusLabel = isConfirmed ? "Confirmed" : "Rejected";
  const subject = `Seatwise Reservation ${statusLabel}`;

  const textBody = [
    `Hi ${payload.customerName},`,
    "",
    isConfirmed
      ? "Your reservation payment has been verified."
      : "Your reservation payment could not be verified and the reservation has been rejected.",
    "",
    "Reservation details:",
    buildReservationSummary(payload.lineItems),
    "",
    isConfirmed
      ? `Receipt image: ${receiptImageUrls.join(", ")}`
      : "If you need help, please contact the organizer or admin team for assistance.",
    "",
    "Thank you,",
    "Seatwise Team",
  ].join(CRLF);

  const htmlBody = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#111827;line-height:1.6">
      <p>Hi ${escapeHtml(payload.customerName)},</p>
      <p>${
        isConfirmed
          ? "Your reservation payment has been verified."
          : "Your reservation payment could not be verified and the reservation has been rejected."
      }</p>
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f9fafb">
        <p style="margin:0 0 10px 0"><strong>Reservation details</strong></p>
        ${payload.lineItems
          .map(
            (item, index) => `
              <div style="${index > 0 ? "margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;" : ""}">
                <p><strong>${escapeHtml(item.showName)}</strong></p>
                <p><strong>Reservation No:</strong> ${escapeHtml(item.reservationNumber)}</p>
                <p><strong>Schedule:</strong> ${escapeHtml(item.scheduleLabel)}</p>
                <p><strong>Seats:</strong> ${escapeHtml(item.seatNumbers.join(", "))}</p>
                <p><strong>Amount:</strong> ${escapeHtml(item.amount)}</p>
              </div>
            `.trim(),
          )
          .join("")}
      </div>
      ${
        isConfirmed
          ? `<p style="margin-top:20px">Your receipt image is shown below for reference. The same image is also attached as a downloadable file.</p>
             ${receiptImageUrls
               .map(
                 (url, index) => `
                   <div style="margin-top:24px">
                     <p style="font-weight:600;margin-bottom:10px">Receipt ${index + 1}</p>
                     <img src="${escapeHtml(url)}" alt="Reservation receipt ${index + 1}" style="display:block;max-width:100%;border-radius:16px;border:1px solid #d1d5db" />
                   </div>
                 `.trim(),
               )
               .join("")}`
          : "<p style=\"margin-top:20px\">If you need help, please contact the organizer or admin team for assistance.</p>"
      }
      <p style="margin-top:20px">Thank you,<br />Seatwise Team</p>
    </div>
  `.trim();

  const mixedBoundary = `seatwise-status-mixed-${Date.now()}`;
  const alternativeBoundary = `seatwise-status-alt-${Date.now()}`;
  const rawParts = [
    `From: Seatwise <${sender}>`,
    `To: ${payload.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    textBody,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
    "",
    `--${alternativeBoundary}--`,
  ];

  for (const attachment of receiptAttachments) {
    rawParts.push(
      "",
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      encodeAttachmentBody(attachment.content),
    );
  }

  rawParts.push("", `--${mixedBoundary}--`);
  return rawParts.join(CRLF);
};

export type {
  EmailImageAttachment,
  ReservationStatusEmailLineItem,
  ReservationStatusUpdateEmailPayload,
  ReservationSubmittedEmailPayload,
  WalkInReceiptEmailPayload,
};
