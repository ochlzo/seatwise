import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import QRCode from "qrcode";
import { getTicketFontConfigPath } from "./fontConfig.server.ts";
import type { TicketTemplateVersion } from "./types.ts";

type RenderTicketPngParams = {
  template: TicketTemplateVersion;
  fields: Partial<Record<string, string>>;
  qrValue: string;
};

async function buildQrDataUrl(qrValue: string, size: number) {
  return QRCode.toDataURL(qrValue, {
    width: size,
    margin: 0,
    color: {
      dark: "#000000ff",
      light: "#ffffffff",
    },
  });
}

type WorkerSuccess = {
  ok: true;
  ticketPngBase64: string;
};

type WorkerFailure = {
  ok: false;
  error: string;
};

type WorkerResponse = WorkerSuccess | WorkerFailure;

const renderTicketRuntimePath = fileURLToPath(
  new URL("./renderTicketPng.runtime.mjs", import.meta.url),
);

export async function renderTicketPng(input: RenderTicketPngParams) {
  const fontConfigPath = await getTicketFontConfigPath();
  const qrDataUrl = await buildQrDataUrl(input.qrValue, 1024);

  return new Promise<Uint8Array>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [renderTicketRuntimePath],
      {
        env: {
          ...process.env,
          FONTCONFIG_FILE: fontConfigPath,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();

      if (!stdout) {
        reject(
          new Error(
            stderr
              ? `Ticket renderer exited without output (code ${code ?? "unknown"}): ${stderr}`
              : `Ticket renderer exited before producing output (code ${code ?? "unknown"}).`,
          ),
        );
        return;
      }

      let response: WorkerResponse;
      try {
        response = JSON.parse(stdout) as WorkerResponse;
      } catch {
        reject(
          new Error(
            stderr || "Ticket renderer returned an invalid response payload.",
          ),
        );
        return;
      }

      if (!response.ok) {
        reject(new Error(response.error));
        return;
      }

      resolve(Buffer.from(response.ticketPngBase64, "base64"));
    });

    child.stdin.end(
      JSON.stringify({
        ...input,
        qrDataUrl,
      }),
    );
  });
}
