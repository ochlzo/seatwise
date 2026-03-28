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
  ticketAttachments: Array<{
    filename: string;
    contentType: string;
    content: Uint8Array;
  }>;
};

export const sendIssuedTicketEmail = async ({
  ticketAttachments,
  ...payload
}: SendIssuedTicketEmailInput) => {
  const sender = getGmailSender();
  const rawMessage = buildIssuedTicketEmailMessage({
    sender,
    payload,
    ticketAttachments: ticketAttachments.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      content: Buffer.from(attachment.content),
    })),
  });

  await sendGmailRawMessage(encodeGmailRawMessage(rawMessage));
};
