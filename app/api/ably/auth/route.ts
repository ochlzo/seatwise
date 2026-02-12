import { NextRequest, NextResponse } from 'next/server';
import { createAblyTokenRequest } from '@/lib/clients/ably';

/**
 * Ably Token Authentication Endpoint
 * Provides secure token-based authentication for client-side Ably connections
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ticketId, showScopeId } = body;

        // Validate required fields
        if (!ticketId || !showScopeId) {
            return NextResponse.json(
                { error: 'ticketId and showScopeId are required' },
                { status: 400 }
            );
        }

        // TODO: Add additional validation
        // - Verify user session
        // - Check if ticketId belongs to the authenticated user
        // - Verify showScopeId exists and queue is active

        // Create token request with restricted permissions
        const tokenRequest = await createAblyTokenRequest(ticketId, showScopeId);

        return NextResponse.json(tokenRequest);
    } catch (error) {
        console.error('Failed to create Ably token request:', error);
        return NextResponse.json(
            {
                error: 'Failed to create authentication token',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
