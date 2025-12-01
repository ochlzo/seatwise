import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const { idToken } = await req.json();
        if (!idToken) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        // 1. Verify with Firebase Admin (Check if ID token is valid first)
        // Note: createSessionCookie verifies the token implicitly, but explicit verification 
        // allows extracting claims before creating the session if needed.
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;

        // 2. Create Session Cookie
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

        const cookieStore = await cookies();
        cookieStore.set('session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        // 3. Upsert user in MySQL DB
        const email = decoded.email ?? null;
        const name = decoded.name ?? '';
        const [firstName, ...rest] = name.split(' ');
        const lastName = rest.join(' ') || null;

        const user = await prisma.user.upsert({
            where: { firebase_uid: uid },
            update: {
                email,
                first_name: firstName || null,
                last_name: lastName,
            },
            create: {
                firebase_uid: uid,
                email,
                first_name: firstName || null,
                last_name: lastName,
            },
        });

        return NextResponse.json({ user });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}
