import {
  encodeGmailRawMessage,
  getGmailSender,
  sendGmailRawMessage,
} from "@/lib/email/gmailClient";
import {
  buildReservationStatusUpdateEmailMessage,
  type ReservationStatusUpdateEmailPayload,
} from "@/lib/email/reservationEmailMessages";

export const sendReservationStatusUpdateEmail = async (
  payload: ReservationStatusUpdateEmailPayload,
) => {
  const sender = getGmailSender();
  const rawMessage = buildReservationStatusUpdateEmailMessage({
    sender,
    payload,
  });

  await sendGmailRawMessage(encodeGmailRawMessage(rawMessage));
};
