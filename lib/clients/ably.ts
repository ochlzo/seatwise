import * as Ably from 'ably';

if (!process.env.ABLY_API_KEY) {
    throw new Error('ABLY_API_KEY is not defined');
}

// Server-side Ably client (uses API key)
export const ably = new Ably.Rest({
    key: process.env.ABLY_API_KEY,
});

// Helper to create token request for client authentication
export async function createAblyTokenRequest(
    clientId: string,
    showScopeId: string
) {
    return await ably.auth.createTokenRequest({
        clientId,
        capability: {
            // Public channel - subscribe only
            [`seatwise:${showScopeId}:public`]: ['subscribe'],
            // Private channel - subscribe only to own channel
            [`seatwise:${showScopeId}:private:${clientId}`]: ['subscribe'],
        },
        ttl: 3600000, // 1 hour
    });
}
