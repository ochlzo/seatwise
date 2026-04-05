import { Buffer } from "node:buffer";

import { renderTicketPngInline } from "./renderTicketPng.inline.ts";

type WorkerInput = {
  template: Parameters<typeof renderTicketPngInline>[0]["template"];
  fields: Parameters<typeof renderTicketPngInline>[0]["fields"];
  qrValue: Parameters<typeof renderTicketPngInline>[0]["qrValue"];
};

async function readInput() {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as WorkerInput;
}

try {
  const input = await readInput();
  const ticketPng = await renderTicketPngInline(input);
  process.stdout.write(
    JSON.stringify({
      ok: true,
      ticketPngBase64: Buffer.from(ticketPng).toString("base64"),
    }),
  );
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to render ticket PNG.",
    }),
  );
  process.exitCode = 1;
}
