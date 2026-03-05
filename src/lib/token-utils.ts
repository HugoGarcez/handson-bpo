import { cookies } from 'next/headers';

const TOKEN_URL = process.env.CONTA_AZUL_TOKEN_URL || 'https://auth.contaazul.com/oauth2/token';
const CLIENT_ID = process.env.CONTA_AZUL_CLIENT_ID;
const CLIENT_SECRET = process.env.CONTA_AZUL_CLIENT_SECRET;

export async function refreshContaAzulToken() {
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('contaazul_refresh_token')?.value;

    if (!refreshToken) {
        console.error('[Token Refresh] No refresh token found in cookies');
        return null;
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('[Token Refresh] Missing client credentials');
        return null;
    }

    try {
        const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);

        console.log('[Token Refresh] Attempting to refresh token...');
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Token Refresh] Failed to refresh token:', data);
            return null;
        }

        console.log('[Token Refresh] Token refreshed successfully');

        // Update cookies with new tokens
        // Note: In Next.js App Router, we can set cookies in Server Actions or Route Handlers
        // This function will return the new token and the caller (Route Handler) will set the cookies
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in
        };
    } catch (error) {
        console.error('[Token Refresh] Error during token refresh:', error);
        return null;
    }
}
