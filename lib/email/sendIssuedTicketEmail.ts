import {
  encodeGmailRawMessage,
  getGmailSender,
  sendGmailRawMessage,
} from "@/lib/email/gmailClient";

import {
  buildIssuedTicketEmailMessage,
  type IssuedTicketEmailPayload,
} from "./ticketEmailMessages.ts";

type SendIssuedTicketEmailInput = IssuedTicketEmailPayload & {
  ticketPdf: Uint8Array;
  ticketPdfFilename: string;
};

export const sendIssuedTicketEmail = async ({
  ticketPdf,
  ticketPdfFilename,
  ...payload
}: SendIssuedTicketEmailInput) => {
  const sender = getGmailSender();
  const rawMessage = buildIssuedTicketEmailMessage({
    sender,
    payload,
    ticketAttachment: {
      filename: ticketPdfFilename,
      contentType: "application/pdf",
      content: Buffer.from(ticketPdf),
    },
  });

  await sendGmailRawMessage(encodeGmailRawMessage(rawMessage));
};
