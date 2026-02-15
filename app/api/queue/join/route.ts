import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { joinQueue } from '@/lib/queue/joinQueue';
import { promoteNextInQueue } from '@/lib/queue/queueLifecycle';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify user session
        const { adminAuth } = await import('@/lib/firebaseAdmin');
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('session')?.value;

        if (!sessionCookie) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);

        // 2. Get user from database
        const user = await prisma.user.findUnique({
            where: { firebase_uid: decodedToken.uid },
            select: {
                user_id: true,
                first_name: true,
                last_name: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        // 3. Parse request body
        const body = await request.json();
        const { showId, schedId } = body;

        if (!showId || !schedId) {
            return NextResponse.json(
                { success: false, error: 'Missing showId or schedId' },
                { status: 400 }
            );
        }

        // 4. Verify show and schedule exist
        const schedule = await prisma.sched.findFirst({
            where: {
                sched_id: schedId,
                show_id: showId,
            },
            include: {
                show: {
                    select: {
                        show_status: true,
                        show_name: true,
                    },
                },
            },
        });

        if (!schedule) {
            return NextResponse.json(
                { success: false, error: 'Schedule not found' },
                { status: 404 }
            );
        }

        // 5. Verify show is OPEN
        if (schedule.show.show_status !== 'OPEN') {
            return NextResponse.json(
                { success: false, error: 'This show is not currently accepting reservations' },
                { status: 400 }
            );
        }

        // 6. Join the queue
        const showScopeId = `${showId}:${schedId}`;
        const userName = `${user.first_name} ${user.last_name}`.trim();

        const result = await joinQueue({
            showScopeId,
            userId: user.user_id,
            userName,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        const promotion = await promoteNextInQueue({ showScopeId });
        const promotedNow =
            promotion.promoted && promotion.activeSession?.ticketId === result.ticket?.ticketId;

        // 7. Return success with ticket data
        return NextResponse.json({
            success: true,
            ticket: result.ticket,
            rank: result.rank,
            estimatedWaitMinutes: result.estimatedWaitMinutes,
            showName: schedule.show.show_name,
            status: promotedNow ? 'active' : 'waiting',
            activeToken: promotedNow ? promotion.activeSession?.activeToken : undefined,
            expiresAt: promotedNow ? promotion.activeSession?.expiresAt : undefined,
        });
    } catch (error) {
        console.error('Error in /api/queue/join:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}
