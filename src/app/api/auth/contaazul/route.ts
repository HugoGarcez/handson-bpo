import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.CONTA_AZUL_CLIENT_ID || '61gkraesmrc5ncsaooe4t0m668';
const CLIENT_SECRET = process.env.CONTA_AZUL_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.CONTA_AZUL_REDIRECT_URI || 'https://site-promp-handson-dpo.458gfr.easypanel.host/api/auth/contaazul';
const TOKEN_URL = process.env.CONTA_AZUL_TOKEN_URL || 'https://auth.contaazul.com/oauth2/token';
const AUTH_URL = process.env.CONTA_AZUL_AUTH_URL || 'https://auth.contaazul.com/login';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    // ——— CALLBACK: Arrived with an authorization code ———
    if (code) {
        if (!CLIENT_SECRET) {
            return NextResponse.json({ error: 'Missing CONTA_AZUL_CLIENT_SECRET' }, { status: 500 });
        }

        try {
            console.log('[ContaAzul Callback] Exchanging code for token...');
            const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('redirect_uri', REDIRECT_URI);

            const response = await fetch(TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('[ContaAzul Callback] Token exchange failed:', data);
                return NextResponse.json({ error: 'Failed to fetch token', details: data }, { status: response.status });
            }

            console.log('[ContaAzul Callback] Token exchange succeeded! has_access_token:', !!data.access_token);

            // Determine base URL from headers (handles reverse proxies like EasyPanel)
            const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
            const protocol = request.headers.get('x-forwarded-proto') || 'https';
            const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

            const res = NextResponse.redirect(new URL('/dashboard', baseUrl));

            if (data.access_token) {
                res.cookies.set('contaazul_access_token', data.access_token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    path: '/',
                    maxAge: data.expires_in || 3600,
                    sameSite: 'lax',
                });
            }

            if (data.refresh_token) {
                res.cookies.set('contaazul_refresh_token', data.refresh_token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    path: '/',
                    maxAge: 30 * 24 * 60 * 60,
                    sameSite: 'lax',
                });
            }

            return res;

        } catch (error) {
            console.error('[ContaAzul Callback] Exception:', error);
            return NextResponse.json({ error: 'Internal server error during token exchange' }, { status: 500 });
        }
    }

    // ——— INITIATE: No code, redirect user to Conta Azul authorization ———
    if (!CLIENT_ID) {
        return new NextResponse('Missing CONTA_AZUL_CLIENT_ID', { status: 500 });
    }

    const authUrl = new URL(AUTH_URL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', 'random_state_string_123');
    authUrl.searchParams.set('scope', 'openid profile aws.cognito.signin.user.admin');

    console.log(`[ContaAzul] Redirecting to: ${authUrl.toString()}`);
    return NextResponse.redirect(authUrl.toString());
}
