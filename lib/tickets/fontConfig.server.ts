import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const TICKET_FONTCONFIG_PREFIX = "seatwise-ticket-fontconfig-";

let ticketFontConfigPromise: Promise<string> | null = null;

function normalizeForFontConfig(path: string) {
  return path.replaceAll("\\", "/");
}

export function buildTicketFontConfigXml(fontsDir: string, cacheDir: string) {
  return `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <include ignore_missing="yes">/usr/local/etc/fonts/fonts.conf</include>
  <dir>${normalizeForFontConfig(fontsDir)}</dir>
  <cachedir>${normalizeForFontConfig(cacheDir)}</cachedir>
  <config></config>
</fontconfig>
`;
}

async function createTicketFontConfigFile(fontsDir: string) {
  const tempDir = await mkdtemp(join(tmpdir(), TICKET_FONTCONFIG_PREFIX));
  const cacheDir = join(tempDir, "cache");
  const fontConfigPath = join(tempDir, "fonts.conf");

  await mkdir(cacheDir, { recursive: true });
  await writeFile(
    fontConfigPath,
    buildTicketFontConfigXml(fontsDir, cacheDir),
    "utf8",
  );

  return fontConfigPath;
}

export async function getTicketFontConfigPath() {
  if (ticketFontConfigPromise) {
    return ticketFontConfigPromise;
  }

  ticketFontConfigPromise = (async () => {
    const fontsDir = resolve(process.cwd(), "public", "fonts", "tickets");
    await access(fontsDir);

    return createTicketFontConfigFile(fontsDir);
  })();

  try {
    return await ticketFontConfigPromise;
  } catch (error) {
    ticketFontConfigPromise = null;
    throw error;
  }
}
