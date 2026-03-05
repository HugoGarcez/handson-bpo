import { cookies } from 'next/headers';

export interface TokenData {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface RefreshResult {
    success: boolean;
    data?: TokenData;
    error?: string;
    details?: any;
}

const TOKEN_URL = process.env.CONTA_AZUL_TOKEN_URL || 'https://auth.contaazul.com/oauth2/token';
const CLIENT_ID = process.env.CONTA_AZUL_CLIENT_ID;
const CLIENT_SECRET = process.env.CONTA_AZUL_CLIENT_SECRET;

export async function refreshContaAzulToken(): Promise<RefreshResult> {
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('contaazul_refresh_token')?.value;

    if (!refreshToken) {
        return { success: false, error: 'No refresh token found in cookies' };
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return {
            success: false,
            error: 'Missing client credentials (ENV)',
            details: { hasClientId: !!CLIENT_ID, hasClientSecret: !!CLIENT_SECRET }
        };
    }

    try {
        const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);

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
            return {
                success: false,
                error: `API error (status ${response.status})`,
                details: data
            };
        }

        if (!data.access_token) {
            return { success: false, error: 'Response OK but no access_token found', details: data };
        }

        return {
            success: true,
            data: {
                accessToken: data.access_token,
                refreshToken: data.refresh_token || refreshToken,
                expiresIn: data.expires_in || 3600
            }
        };
    } catch (error) {
        return { success: false, error: `Exception: ${String(error)}` };
    }
}
