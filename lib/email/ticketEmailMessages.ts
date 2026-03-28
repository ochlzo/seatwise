type EmailBinaryAttachment = {
  filename: string;
  contentType: string;
  content: Buffer | Uint8Array;
};

export type IssuedTicketEmailPayload = {
  to: string;
  customerName: string;
  reservationNumber: string;
  showName: string;
  venue: string;
  scheduleLabel: string;
  seatLabels: string[];
};

const CRLF = "\r\n";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const encodeAttachmentBody = (content: Buffer | Uint8Array) =>
  Buffer.from(content).toString("base64").replace(/(.{76})/g, `$1${CRLF}`);

export const buildIssuedTicketEmailMessage = ({
  sender,
  payload,
  ticketAttachment,
}: {
  sender: string;
  payload: IssuedTicketEmailPayload;
  ticketAttachment: EmailBinaryAttachment;
}) => {
  const seatList = payload.seatLabels.join(", ");
  const textBody = [
    `Hi ${payload.customerName},`,
    "",
    "Your Seatwise ticket is attached as a PDF.",
    "",
    `Reservation Number: ${payload.reservationNumber}`,
    `Show: ${payload.showName}`,
    `Venue: ${payload.venue}`,
    `Schedule: ${payload.scheduleLabel}`,
    `Seats: ${seatList}`,
    "",
    "Please bring the attached PDF ticket for scanning at the venue.",
    "",
    "Thank you,",
    "Seatwise Team",
  ].join(CRLF);

  const htmlBody = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#111827;line-height:1.6">
      <p>Hi ${escapeHtml(payload.customerName)},</p>
      <p>Your attached PDF ticket is ready.</p>
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f9fafb">
        <p><strong>Reservation Number:</strong> ${escapeHtml(payload.reservationNumber)}</p>
        <p><strong>Show:</strong> ${escapeHtml(payload.showName)}</p>
        <p><strong>Venue:</strong> ${escapeHtml(payload.venue)}</p>
        <p><strong>Schedule:</strong> ${escapeHtml(payload.scheduleLabel)}</p>
        <p><strong>Seats:</strong> ${escapeHtml(seatList)}</p>
      </div>
      <p style="margin-top:20px">Please bring the attached PDF ticket for scanning at the venue.</p>
      <p style="margin-top:20px">Thank you,<br />Seatwise Team</p>
    </div>
  `.trim();

  const mixedBoundary = `seatwise-ticket-mixed-${payload.reservationNumber}`;
  const alternativeBoundary = `seatwise-ticket-alt-${payload.reservationNumber}`;

  return [
    `From: Seatwise <${sender}>`,
    `To: ${payload.to}`,
    `Subject: Your Seatwise Ticket - ${payload.showName}`,
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
    `Content-Type: ${ticketAttachment.contentType}; name="${ticketAttachment.filename}"`,
    `Content-Disposition: attachment; filename="${ticketAttachment.filename}"`,
    "Content-Transfer-Encoding: Base64",
    "",
    encodeAttachmentBody(ticketAttachment.content),
    "",
    `--${mixedBoundary}--`,
  ].join(CRLF);
};

export type { EmailBinaryAttachment };
