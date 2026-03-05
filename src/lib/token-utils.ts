import { cookies } from 'next/headers';

export interface TokenData {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

const TOKEN_URL = process.env.CONTA_AZUL_TOKEN_URL || 'https://auth.contaazul.com/oauth2/token';
const CLIENT_ID = process.env.CONTA_AZUL_CLIENT_ID;
const CLIENT_SECRET = process.env.CONTA_AZUL_CLIENT_SECRET;

export async function refreshContaAzulToken(): Promise<TokenData | null> {
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

        console.log('[Token Refresh] Attempting to refresh token with refresh_token (length):', refreshToken.length);

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
            console.error('[Token Refresh] FAILED! Status:', response.status, 'Response:', JSON.stringify(data));
            return null;
        }

        console.log('[Token Refresh] SUCCESS! New Access Token length:', data.access_token?.length);

        if (!data.access_token) {
            console.error('[Token Refresh] Response OK but no access_token found in body:', data);
            return null;
        }

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken, // fallback to old if not provided
            expiresIn: data.expires_in || 3600
        };
    } catch (error) {
        console.error('[Token Refresh] Error during token refresh fetch:', error);
        return null;
    }
}
