import {
  encodeGmailRawMessage,
  fetchRemoteEmailImage,
  getGmailSender,
  sendGmailRawMessage,
} from "@/lib/email/gmailClient";
import {
  buildWalkInReceiptEmailMessage,
  type WalkInReceiptEmailPayload,
} from "@/lib/email/reservationEmailMessages";

export const sendWalkInReceiptEmail = async (payload: WalkInReceiptEmailPayload) => {
  const sender = getGmailSender();
  const receiptAttachment = await fetchRemoteEmailImage(
    payload.receiptImageUrl,
    `walk-in-receipt-${payload.reservationNumber}`,
  );
  const rawMessage = buildWalkInReceiptEmailMessage({
    sender,
    payload,
    receiptAttachment,
  });

  await sendGmailRawMessage(encodeGmailRawMessage(rawMessage));
};
