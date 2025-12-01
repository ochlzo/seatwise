import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

if (!projectId || !clientEmail || !privateKey) {
    console.error(
        'Missing Firebase Admin credentials. Please check your .env file.'
    );
}

if (!getApps().length) {
    if (projectId && clientEmail && privateKey) {
        initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }
}

export const adminAuth = getAuth();