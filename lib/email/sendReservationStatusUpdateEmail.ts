import {
  encodeGmailRawMessage,
  fetchRemoteEmailImage,
  getGmailSender,
  sendGmailRawMessage,
} from "@/lib/email/gmailClient";
import {
  buildReservationStatusUpdateEmailMessage,
  type ReservationStatusUpdateEmailPayload,
} from "@/lib/email/reservationEmailMessages";
import { uploadWalkInReceiptImage } from "@/lib/walk-in/uploadReceiptImage";

const parseCurrencyToNumber = (value: string) => Number(value.replace(/[^\d.]/g, "")) || 0;

export const sendReservationStatusUpdateEmail = async (
  payload: ReservationStatusUpdateEmailPayload,
) => {
  const sender = getGmailSender();
  const isConfirmed = payload.targetStatus === "CONFIRMED";

  const receiptImageUrls = isConfirmed
    ? await Promise.all(
        payload.lineItems.map((item) =>
          uploadWalkInReceiptImage(
            {
              reservationNumber: item.reservationNumber,
              customerName: payload.customerName,
              showName: item.showName,
              venue: item.venue,
              scheduleLabel: item.scheduleLabel,
              seatNumbers: item.seatNumbers,
              totalAmount: parseCurrencyToNumber(item.amount),
              title: "Seatwise Reservation Receipt",
              headline: "Payment verified",
              paymentMethodLabel: `Method: ${item.paymentMethod ?? "GCASH"}`,
            },
            {
              folder: "seatwise/settings/reservation_receipts",
              publicIdPrefix: "reservation-receipt",
              format: "png",
            },
          ),
        ),
      )
    : [];

  const receiptAttachments = await Promise.all(
    receiptImageUrls.map((url, index) =>
      fetchRemoteEmailImage(url, `reservation-receipt-${payload.lineItems[index]?.reservationNumber ?? index + 1}`),
    ),
  );
  const rawMessage = buildReservationStatusUpdateEmailMessage({
    sender,
    payload,
    receiptImageUrls,
    receiptAttachments,
  });

  await sendGmailRawMessage(encodeGmailRawMessage(rawMessage));
};
