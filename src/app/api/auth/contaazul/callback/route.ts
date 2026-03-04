import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
    }

    const TOKEN_URL = process.env.CONTA_AZUL_TOKEN_URL || 'https://auth.contaazul.com/oauth2/token';
    const CLIENT_ID = process.env.CONTA_AZUL_CLIENT_ID;
    const CLIENT_SECRET = process.env.CONTA_AZUL_CLIENT_SECRET;
    const REDIRECT_URI = process.env.CONTA_AZUL_REDIRECT_URI;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return NextResponse.json({ error: 'Missing client credentials' }, { status: 500 });
    }

    try {
        const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI!);

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
            console.error('Error fetching token:', data);
            return NextResponse.json({ error: 'Failed to fetch token', details: data }, { status: response.status });
        }

        // Successfully got token!
        console.log('Successfully retrieved Conta Azul token:', {
            expires_in: data.expires_in,
            has_access_token: !!data.access_token,
            has_refresh_token: !!data.refresh_token
        });

        // In a real application, you would store this token securely (e.g., HTTP-only cookie, database)
        // For now, we'll set a basic cookie to know the user is authenticated on the frontend

        // Get original host from headers to handle reverse proxies like EasyPanel
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const res = NextResponse.redirect(new URL('/dashboard', baseUrl));
        res.cookies.set('contaazul_access_token', data.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: data.expires_in
        });

        if (data.refresh_token) {
            res.cookies.set('contaazul_refresh_token', data.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 30 * 24 * 60 * 60 // 30 days
            });
        }

        return res;

    } catch (error) {
        console.error('Token exchange error:', error);
        return NextResponse.json({ error: 'Internal server error during token exchange' }, { status: 500 });
    }
}
