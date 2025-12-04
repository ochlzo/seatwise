import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) {
        return NextResponse.json({ isAuthenticated: false }, { status: 401 });
    }

    try {
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
        const uid = decodedClaims.uid;

        // Fetch user details from Prisma
        const user = await prisma.user.findUnique({
            where: { firebase_uid: uid },
        });

        if (!user) {
            return NextResponse.json({ isAuthenticated: false }, { status: 401 });
        }

        return NextResponse.json({
            isAuthenticated: true,
            user: {
                uid: user.firebase_uid,
                email: user.email,
                displayName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                role: user.role,
            }
        });
    } catch (error) {
        return NextResponse.json({ isAuthenticated: false }, { status: 401 });
    }
}
