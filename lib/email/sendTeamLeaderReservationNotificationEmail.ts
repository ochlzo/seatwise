import {
  encodeGmailRawMessage,
  fetchRemoteEmailImage,
  getGmailSender,
  sendGmailRawMessage,
} from "@/lib/email/gmailClient";
import {
  buildTeamLeaderReservationNotificationEmailMessage,
  type TeamLeaderReservationNotificationPayload,
} from "@/lib/email/reservationEmailMessages";

export const sendTeamLeaderReservationNotificationEmail = async (
  payload: TeamLeaderReservationNotificationPayload,
) => {
  const sender = getGmailSender();
  const proofAttachment =
    payload.proofImageUrl != null
      ? await fetchRemoteEmailImage(
          payload.proofImageUrl,
          `gcash-proof-${payload.reservationNumber}`,
        )
      : null;
  const rawMessage = buildTeamLeaderReservationNotificationEmailMessage({
    sender,
    payload,
    proofAttachment,
  });

  await sendGmailRawMessage(encodeGmailRawMessage(rawMessage));
};
