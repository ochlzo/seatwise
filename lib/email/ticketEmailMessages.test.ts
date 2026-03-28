import assert from "node:assert/strict";
import test from "node:test";

const sender = "seatwise@example.com";

test("buildIssuedTicketEmailMessage attaches a PDF with the expected filename", async () => {
  const { buildIssuedTicketEmailMessage } = await import("./ticketEmailMessages.ts");

  const raw = buildIssuedTicketEmailMessage({
    sender,
    payload: {
      to: "ada@example.com",
      customerName: "Ada Lovelace",
      reservationNumber: "4821",
      showName: "Seatwise Live",
      venue: "Main Hall",
      scheduleLabel: "Apr 10, 2026, 7:00 PM",
      seatLabels: ["A1", "A2"],
    },
    ticketAttachment: {
      filename: "seatwise-ticket-4821.pdf",
      contentType: "application/pdf",
      content: Buffer.from("%PDF-1.7 ticket"),
    },
  });

  assert.match(raw, /Subject: Your Seatwise Ticket - Seatwise Live/);
  assert.match(raw, /Content-Type: application\/pdf; name="seatwise-ticket-4821\.pdf"/);
  assert.match(raw, /Content-Disposition: attachment; filename="seatwise-ticket-4821\.pdf"/);
  assert.match(raw, /Base64/iu);
});

test("buildIssuedTicketEmailMessage does not inline or reference generated receipt images", async () => {
  const { buildIssuedTicketEmailMessage } = await import("./ticketEmailMessages.ts");

  const raw = buildIssuedTicketEmailMessage({
    sender,
    payload: {
      to: "ada@example.com",
      customerName: "Ada Lovelace",
      reservationNumber: "4821",
      showName: "Seatwise Live",
      venue: "Main Hall",
      scheduleLabel: "Apr 10, 2026, 7:00 PM",
      seatLabels: ["A1", "A2"],
    },
    ticketAttachment: {
      filename: "seatwise-ticket-4821.pdf",
      contentType: "application/pdf",
      content: Buffer.from("%PDF-1.7 ticket"),
    },
  });

  assert.doesNotMatch(raw, /Receipt image/i);
  assert.doesNotMatch(raw, /walk-in receipt/i);
  assert.doesNotMatch(raw, /reservation receipt/i);
  assert.doesNotMatch(raw, /https?:\/\/[^\s"]+/i);
  assert.match(raw, /attached PDF ticket/i);
});
