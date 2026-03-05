import { NextResponse } from 'next/server';

export async function GET() {
    const CONTA_AZUL_AUTH_URL = process.env.CONTA_AZUL_AUTH_URL || 'https://api.contaazul.com/auth/authorize';
    const CLIENT_ID = process.env.CONTA_AZUL_CLIENT_ID || '';
    const REDIRECT_URI = process.env.CONTA_AZUL_REDIRECT_URI || 'https://meuapp.com/api/auth/contaazul/callback';
    const STATE = 'random_state_string_123'; // In production, use crypto.randomUUID() and store in cookie

    if (!CLIENT_ID) {
        return new NextResponse('Missing CONTA_AZUL_CLIENT_ID', { status: 500 });
    }

    const authUrl = new URL(CONTA_AZUL_AUTH_URL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', STATE);
    authUrl.searchParams.set('scope', 'sales'); // Necessary for most data routes


    console.log(`Redirecting to Conta Azul: ${authUrl.toString()}`);
    return NextResponse.redirect(authUrl.toString());
}
