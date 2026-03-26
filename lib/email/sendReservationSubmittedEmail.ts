import {
  encodeGmailRawMessage,
  fetchRemoteEmailImage,
  getGmailSender,
  sendGmailRawMessage,
} from "@/lib/email/gmailClient";
import {
  buildReservationSubmittedEmailMessage,
  type ReservationSubmittedEmailPayload,
} from "@/lib/email/reservationEmailMessages";

export const sendReservationSubmittedEmail = async (payload: ReservationSubmittedEmailPayload) => {
  const sender = getGmailSender();
  const proofAttachment =
    payload.proofImageUrl != null
      ? await fetchRemoteEmailImage(
          payload.proofImageUrl,
          `gcash-proof-${payload.reservationNumber}`,
        )
      : null;
  const rawMessage = buildReservationSubmittedEmailMessage({
    sender,
    payload,
    proofAttachment,
  });

  await sendGmailRawMessage(encodeGmailRawMessage(rawMessage));
};
