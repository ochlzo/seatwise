import fs from "node:fs";
import path from "node:path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { PrismaClient } from "@prisma/client";

function loadDotEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    if (!key || key in process.env) {
      continue;
    }

    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnvIfPresent();
const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "johnbenedictkandelarya@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "123456";
const DEFAULT_ADMIN_USERNAME = "johnbenedict";
const DEFAULT_ADMIN_FIRST_NAME = "John Benedict";
const DEFAULT_ADMIN_LAST_NAME = "Kandelarya";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    "Missing FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY in environment.",
  );
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const adminAuth = getAuth();

const ensureFirebaseUser = async () => {
  try {
    const existing = await adminAuth.getUserByEmail(DEFAULT_ADMIN_EMAIL);
    await adminAuth.updateUser(existing.uid, {
      password: DEFAULT_ADMIN_PASSWORD,
      displayName: `${DEFAULT_ADMIN_FIRST_NAME} ${DEFAULT_ADMIN_LAST_NAME}`,
      emailVerified: true,
      disabled: false,
    });
    return existing.uid;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== "auth/user-not-found") {
      throw error;
    }

    const created = await adminAuth.createUser({
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      displayName: `${DEFAULT_ADMIN_FIRST_NAME} ${DEFAULT_ADMIN_LAST_NAME}`,
      emailVerified: true,
      disabled: false,
    });
    return created.uid;
  }
};

async function main() {
  const firebaseUid = await ensureFirebaseUser();

  await prisma.admin.upsert({
    where: { firebase_uid: firebaseUid },
    update: {
      email: DEFAULT_ADMIN_EMAIL,
      username: DEFAULT_ADMIN_USERNAME,
      first_name: DEFAULT_ADMIN_FIRST_NAME,
      last_name: DEFAULT_ADMIN_LAST_NAME,
      status: "ACTIVE",
    },
    create: {
      firebase_uid: firebaseUid,
      email: DEFAULT_ADMIN_EMAIL,
      username: DEFAULT_ADMIN_USERNAME,
      first_name: DEFAULT_ADMIN_FIRST_NAME,
      last_name: DEFAULT_ADMIN_LAST_NAME,
      status: "ACTIVE",
    },
  });

  // Ensure no stale admin row keeps the same email with another firebase_uid.
  await prisma.admin.deleteMany({
    where: {
      email: DEFAULT_ADMIN_EMAIL,
      firebase_uid: { not: firebaseUid },
    },
  });

  console.log("Default admin ensured successfully.");
  console.log(`Email: ${DEFAULT_ADMIN_EMAIL}`);
  console.log(`Password: ${DEFAULT_ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Failed to create default admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
