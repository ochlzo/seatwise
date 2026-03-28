import { createHmac, timingSafeEqual } from "node:crypto";

export type TicketQrPayload = {
  reservationId: string;
  reservationNumber: string;
  seatAssignmentId: string;
};

type TicketQrSecretOptions = {
  secret?: string;
};

type TicketVerificationUrlOptions = {
  baseUrl: string;
};

const QR_HEADER = {
  alg: "HS256",
  typ: "SWT",
};

function resolveQrSecret(options?: TicketQrSecretOptions) {
  const secret =
    options?.secret ??
    process.env.SEATWISE_TICKET_QR_SECRET ??
    process.env.TICKET_QR_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("Ticket QR secret is required.");
  }

  return secret;
}

function encodeTokenPart(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeTokenPart<TValue>(value: string): TValue {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as TValue;
}

function signToken(input: string, secret: string) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function createSignedQrPayload(
  payload: TicketQrPayload,
  options?: TicketQrSecretOptions,
) {
  const header = encodeTokenPart(QR_HEADER);
  const body = encodeTokenPart(payload);
  const signature = signToken(`${header}.${body}`, resolveQrSecret(options));

  return `${header}.${body}.${signature}`;
}

export function verifySignedQrPayload(
  token: string,
  options?: TicketQrSecretOptions,
): TicketQrPayload | null {
  try {
    const [header, body, signature] = token.split(".");

    if (!header || !body || !signature) {
      return null;
    }

    const expectedSignature = signToken(
      `${header}.${body}`,
      resolveQrSecret(options),
    );

    const actualBytes = Buffer.from(signature, "utf8");
    const expectedBytes = Buffer.from(expectedSignature, "utf8");

    if (
      actualBytes.length !== expectedBytes.length ||
      !timingSafeEqual(actualBytes, expectedBytes)
    ) {
      return null;
    }

    const decodedHeader = decodeTokenPart<typeof QR_HEADER>(header);
    if (decodedHeader.alg !== QR_HEADER.alg || decodedHeader.typ !== QR_HEADER.typ) {
      return null;
    }

    const payload = decodeTokenPart<Partial<TicketQrPayload>>(body);

    if (
      typeof payload.reservationId !== "string" ||
      payload.reservationId.length === 0 ||
      typeof payload.reservationNumber !== "string" ||
      payload.reservationNumber.length === 0 ||
      typeof payload.seatAssignmentId !== "string" ||
      payload.seatAssignmentId.length === 0
    ) {
      return null;
    }

    return {
      reservationId: payload.reservationId,
      reservationNumber: payload.reservationNumber,
      seatAssignmentId: payload.seatAssignmentId,
    };
  } catch {
    return null;
  }
}

export function normalizeScannedTicketToken(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  try {
    const url = new URL(trimmedValue);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const verifyIndex = pathSegments.findIndex((segment) => segment === "verify");

    if (verifyIndex >= 0 && pathSegments.length > verifyIndex + 1) {
      return decodeURIComponent(pathSegments[verifyIndex + 1] ?? "").trim();
    }
  } catch {
    // Non-URL scanner payloads should pass through unchanged.
  }

  return trimmedValue;
}

export function buildTicketVerificationUrl(
  token: string,
  options: TicketVerificationUrlOptions,
) {
  const trimmedBaseUrl = options.baseUrl.replace(/\/+$/, "");
  return `${trimmedBaseUrl}/ticket/verify/${token}`;
}
