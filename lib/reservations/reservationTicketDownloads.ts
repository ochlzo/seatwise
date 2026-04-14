export type ReservationTicketPdf = {
  seatAssignmentId: string;
  seatLabel: string;
  ticketPdfFilename: string;
  ticketPdf: Uint8Array;
};

export type ReservationTicketDownloadArtifact =
  | {
      kind: "pdf";
      filename: string;
      contentType: "application/pdf";
      body: Uint8Array;
    }
  | {
      kind: "zip";
      filename: string;
      contentType: "application/zip";
      body: Uint8Array;
    };

export type ReservationTicketDownloadInput = {
  reservationNumber: string;
  ticketPdfs: ReservationTicketPdf[];
  seatAssignmentId?: string;
};

const encoder = new TextEncoder();
const PDF_CONTENT_TYPE = "application/pdf" as const;
const ZIP_CONTENT_TYPE = "application/zip" as const;

const sanitizeFileComponent = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim();

const buildZipFilename = (reservationNumber: string) =>
  `seatwise-tickets-${sanitizeFileComponent(reservationNumber) || "reservation"}.zip`;

const toBytes = (value: string) => encoder.encode(value);

const concatUint8Arrays = (chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
};

const writeUint16LE = (view: DataView, offset: number, value: number) => {
  view.setUint16(offset, value & 0xffff, true);
};

const writeUint32LE = (view: DataView, offset: number, value: number) => {
  view.setUint32(offset, value >>> 0, true);
};

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

const crc32 = (input: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc = crc32Table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

export function createStoredZipArchive(
  entries: Array<{ filename: string; content: Uint8Array }>,
) {
  const localFileChunks: Uint8Array[] = [];
  const centralDirectoryChunks: Uint8Array[] = [];
  let localHeaderOffset = 0;

  for (const entry of entries) {
    const filenameBytes = toBytes(entry.filename);
    const contentBytes = entry.content;
    const checksum = crc32(contentBytes);
    const localHeader = new Uint8Array(30 + filenameBytes.byteLength);
    const localHeaderView = new DataView(
      localHeader.buffer,
      localHeader.byteOffset,
      localHeader.byteLength,
    );
    writeUint32LE(localHeaderView, 0, 0x04034b50);
    writeUint16LE(localHeaderView, 4, 20);
    writeUint16LE(localHeaderView, 6, 0);
    writeUint16LE(localHeaderView, 8, 0);
    writeUint16LE(localHeaderView, 10, 0);
    writeUint16LE(localHeaderView, 12, 0);
    writeUint32LE(localHeaderView, 14, checksum);
    writeUint32LE(localHeaderView, 18, contentBytes.byteLength);
    writeUint32LE(localHeaderView, 22, contentBytes.byteLength);
    writeUint16LE(localHeaderView, 26, filenameBytes.byteLength);
    writeUint16LE(localHeaderView, 28, 0);
    localHeader.set(filenameBytes, 30);

    localFileChunks.push(localHeader, contentBytes);

    const centralDirectoryRecord = new Uint8Array(46 + filenameBytes.byteLength);
    const centralDirectoryView = new DataView(
      centralDirectoryRecord.buffer,
      centralDirectoryRecord.byteOffset,
      centralDirectoryRecord.byteLength,
    );
    writeUint32LE(centralDirectoryView, 0, 0x02014b50);
    writeUint16LE(centralDirectoryView, 4, 20);
    writeUint16LE(centralDirectoryView, 6, 20);
    writeUint16LE(centralDirectoryView, 8, 0);
    writeUint16LE(centralDirectoryView, 10, 0);
    writeUint16LE(centralDirectoryView, 12, 0);
    writeUint16LE(centralDirectoryView, 14, 0);
    writeUint32LE(centralDirectoryView, 16, checksum);
    writeUint32LE(centralDirectoryView, 20, contentBytes.byteLength);
    writeUint32LE(centralDirectoryView, 24, contentBytes.byteLength);
    writeUint16LE(centralDirectoryView, 28, filenameBytes.byteLength);
    writeUint16LE(centralDirectoryView, 30, 0);
    writeUint16LE(centralDirectoryView, 32, 0);
    writeUint16LE(centralDirectoryView, 34, 0);
    writeUint16LE(centralDirectoryView, 36, 0);
    writeUint32LE(centralDirectoryView, 38, 0);
    writeUint32LE(centralDirectoryView, 42, localHeaderOffset);
    centralDirectoryRecord.set(filenameBytes, 46);
    centralDirectoryChunks.push(centralDirectoryRecord);

    localHeaderOffset += localHeader.byteLength + contentBytes.byteLength;
  }

  const centralDirectory = concatUint8Arrays(centralDirectoryChunks);
  const endRecord = new Uint8Array(22);
  const endRecordView = new DataView(
    endRecord.buffer,
    endRecord.byteOffset,
    endRecord.byteLength,
  );
  writeUint32LE(endRecordView, 0, 0x06054b50);
  writeUint16LE(endRecordView, 4, 0);
  writeUint16LE(endRecordView, 6, 0);
  writeUint16LE(endRecordView, 8, entries.length);
  writeUint16LE(endRecordView, 10, entries.length);
  writeUint32LE(endRecordView, 12, centralDirectory.byteLength);
  writeUint32LE(endRecordView, 16, localHeaderOffset);
  writeUint16LE(endRecordView, 20, 0);

  return concatUint8Arrays([...localFileChunks, centralDirectory, endRecord]);
}

export function resolveReservationTicketDownloadArtifact({
  reservationNumber,
  ticketPdfs,
  seatAssignmentId,
}: ReservationTicketDownloadInput): ReservationTicketDownloadArtifact {
  if (ticketPdfs.length === 0) {
    throw new Error("Reservation has no ticket PDFs to download.");
  }

  if (seatAssignmentId) {
    const selectedTicket = ticketPdfs.find(
      (ticketPdf) => ticketPdf.seatAssignmentId === seatAssignmentId,
    );

    if (!selectedTicket) {
      throw new Error("Seat ticket not found.");
    }

    return {
      kind: "pdf",
      filename: selectedTicket.ticketPdfFilename,
      contentType: PDF_CONTENT_TYPE,
      body: selectedTicket.ticketPdf,
    };
  }

  if (ticketPdfs.length === 1) {
    const [singleTicket] = ticketPdfs;
    return {
      kind: "pdf",
      filename: singleTicket.ticketPdfFilename,
      contentType: PDF_CONTENT_TYPE,
      body: singleTicket.ticketPdf,
    };
  }

  return {
    kind: "zip",
    filename: buildZipFilename(reservationNumber),
    contentType: ZIP_CONTENT_TYPE,
    body: createStoredZipArchive(
      ticketPdfs.map((ticketPdf) => ({
        filename: ticketPdf.ticketPdfFilename,
        content: ticketPdf.ticketPdf,
      })),
    ),
  };
}
