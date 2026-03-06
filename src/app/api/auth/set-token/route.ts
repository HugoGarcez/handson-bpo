import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Route to manually inject Conta Azul tokens via the SettingsMenu.
 * This sets them as httpOnly cookies server-side.
 */
export async function POST(req: NextRequest) {
    try {
        const { accessToken, refreshToken } = await req.json();

        if (!accessToken && !refreshToken) {
            return NextResponse.json({ error: 'At least one token is required' }, { status: 400 });
        }

        const res = NextResponse.json({ success: true, message: 'Tokens saved successfully' });

        if (accessToken) {
            res.cookies.set('contaazul_access_token', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                maxAge: 3600, // 1 hour
                sameSite: 'lax',
            });
        }

        if (refreshToken) {
            res.cookies.set('contaazul_refresh_token', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                maxAge: 30 * 24 * 60 * 60, // 30 days
                sameSite: 'lax',
            });
        }

        return res;
    } catch (error) {
        console.error('Error saving tokens:', error);
        return NextResponse.json({ error: 'Failed to save tokens' }, { status: 500 });
    }
}

/**
 * Route to clear Conta Azul tokens (logout).
 */
export async function DELETE() {
    const res = NextResponse.json({ success: true, message: 'Tokens cleared' });
    res.cookies.delete('contaazul_access_token');
    res.cookies.delete('contaazul_refresh_token');
    return res;
}
