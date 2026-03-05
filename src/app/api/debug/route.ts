import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    const token = cookieStore.get('contaazul_access_token')?.value;
    const allCookies = cookieStore.getAll().map(c => c.name);

    if (!token) {
        return NextResponse.json({
            status: 'NO_TOKEN',
            cookies: allCookies,
            message: 'Cookie contaazul_access_token não encontrado'
        });
    }

    // Testa um endpoint simples do Conta Azul
    const testRes = await fetch('https://api.contaazul.com/v1/sales?page=0&size=1', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        }
    });

    const testBody = await testRes.text();

    return NextResponse.json({
        status: 'TOKEN_FOUND',
        tokenPreview: `${token.substring(0, 30)}...`,
        tokenLength: token.length,
        cookies: allCookies,
        salesApiStatus: testRes.status,
        salesApiResponse: testBody.substring(0, 500),
    });
}
