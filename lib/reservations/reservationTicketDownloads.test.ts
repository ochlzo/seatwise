import assert from "node:assert/strict";

import {
  createStoredZipArchive,
  resolveReservationTicketDownloadArtifact,
} from "./reservationTicketDownloads.ts";

function decodeStoredZipEntries(zipBytes: Uint8Array) {
  const view = new DataView(
    zipBytes.buffer,
    zipBytes.byteOffset,
    zipBytes.byteLength,
  );
  const decoder = new TextDecoder();
  const entries: Array<{ filename: string; content: Uint8Array }> = [];

  let offset = 0;
  while (offset + 4 <= zipBytes.byteLength) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const filenameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);

    assert.equal(compressionMethod, 0);

    const filenameStart = offset + 30;
    const filenameEnd = filenameStart + filenameLength;
    const contentStart = filenameEnd + extraLength;
    const contentEnd = contentStart + compressedSize;

    entries.push({
      filename: decoder.decode(zipBytes.slice(filenameStart, filenameEnd)),
      content: zipBytes.slice(contentStart, contentEnd),
    });

    offset = contentEnd;
  }

  return entries;
}

const singleSeatTicket = resolveReservationTicketDownloadArtifact({
  reservationNumber: "R-1001",
  ticketPdfs: [
    {
      seatAssignmentId: "seat_assignment_1",
      seatLabel: "A-1",
      ticketPdfFilename: "seatwise-ticket-A-1-R-1001.pdf",
      ticketPdf: new Uint8Array([1, 2, 3]),
    },
  ],
});

assert.equal(singleSeatTicket.kind, "pdf");
assert.equal(singleSeatTicket.filename, "seatwise-ticket-A-1-R-1001.pdf");
assert.equal(singleSeatTicket.contentType, "application/pdf");
assert.deepEqual(Array.from(singleSeatTicket.body), [1, 2, 3]);

const multiSeatTicket = resolveReservationTicketDownloadArtifact({
  reservationNumber: "R-1002",
  ticketPdfs: [
    {
      seatAssignmentId: "seat_assignment_1",
      seatLabel: "A-1",
      ticketPdfFilename: "seatwise-ticket-A-1-R-1002.pdf",
      ticketPdf: new Uint8Array([4, 5, 6]),
    },
    {
      seatAssignmentId: "seat_assignment_2",
      seatLabel: "A-2",
      ticketPdfFilename: "seatwise-ticket-A-2-R-1002.pdf",
      ticketPdf: new Uint8Array([7, 8, 9]),
    },
  ],
});

assert.equal(multiSeatTicket.kind, "zip");
assert.equal(multiSeatTicket.filename, "seatwise-tickets-R-1002.zip");
assert.equal(multiSeatTicket.contentType, "application/zip");

const zipEntries = decodeStoredZipEntries(multiSeatTicket.body);
assert.deepEqual(
  zipEntries.map((entry) => entry.filename),
  ["seatwise-ticket-A-1-R-1002.pdf", "seatwise-ticket-A-2-R-1002.pdf"],
);
assert.deepEqual(Array.from(zipEntries[0]?.content ?? []), [4, 5, 6]);
assert.deepEqual(Array.from(zipEntries[1]?.content ?? []), [7, 8, 9]);

const individualSeatTicket = resolveReservationTicketDownloadArtifact({
  reservationNumber: "R-1003",
  seatAssignmentId: "seat_assignment_2",
  ticketPdfs: [
    {
      seatAssignmentId: "seat_assignment_1",
      seatLabel: "A-1",
      ticketPdfFilename: "seatwise-ticket-A-1-R-1003.pdf",
      ticketPdf: new Uint8Array([10]),
    },
    {
      seatAssignmentId: "seat_assignment_2",
      seatLabel: "A-2",
      ticketPdfFilename: "seatwise-ticket-A-2-R-1003.pdf",
      ticketPdf: new Uint8Array([11]),
    },
  ],
});

assert.equal(individualSeatTicket.kind, "pdf");
assert.equal(individualSeatTicket.filename, "seatwise-ticket-A-2-R-1003.pdf");
assert.deepEqual(Array.from(individualSeatTicket.body), [11]);

assert.throws(
  () =>
    resolveReservationTicketDownloadArtifact({
      reservationNumber: "R-1004",
      seatAssignmentId: "missing",
      ticketPdfs: [
        {
          seatAssignmentId: "seat_assignment_1",
          seatLabel: "A-1",
          ticketPdfFilename: "seatwise-ticket-A-1-R-1004.pdf",
          ticketPdf: new Uint8Array([12]),
        },
      ],
    }),
  /Seat ticket not found/,
);

assert.equal(
  createStoredZipArchive([
    {
      filename: "hello.txt",
      content: new Uint8Array([104, 101, 108, 108, 111]),
    },
  ]).slice(0, 4).every((byte, index) => byte === [0x50, 0x4b, 0x03, 0x04][index]),
  true,
);

console.log("reservationTicketDownloads.test.ts passed");
