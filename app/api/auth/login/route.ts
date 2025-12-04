import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const { idToken, username, firstName: reqFirstName, lastName: reqLastName } = await req.json();
        if (!idToken) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        // 1. Verify with Firebase Admin (Check if ID token is valid first)
        // Note: createSessionCookie verifies the token implicitly, but explicit verification 
        // allows extracting claims before creating the session if needed.
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;

        // 2. Create Session Cookie
        const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days
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

        // Use provided names or fallback to decoded token
        let finalFirstName = reqFirstName;
        let finalLastName = reqLastName;

        if (!finalFirstName && decoded.name) {
            const [fName, ...rest] = decoded.name.split(' ');
            finalFirstName = fName;
            finalLastName = rest.join(' ') || null;
        }

        const user = await prisma.user.upsert({
            where: { firebase_uid: uid },
            update: {
                email,
                first_name: finalFirstName || null,
                last_name: finalLastName || null,
                username: username || undefined, // Only update username if provided
                // Do NOT update role here, or it will reset to default
            },
            create: {
                firebase_uid: uid,
                email,
                first_name: finalFirstName || null,
                last_name: finalLastName || null,
                username: username || null,
            },
        });

        return NextResponse.json({ user });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}
