import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshContaAzulToken } from '@/lib/token-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
    const cookieStore = cookies();
    let token = cookieStore.get('contaazul_access_token')?.value;
    const allCookies = cookieStore.getAll().map(c => c.name);

    if (!token) {
        return NextResponse.json({
            status: 'NO_TOKEN',
            cookies: allCookies,
            message: 'Cookie contaazul_access_token não encontrado'
        });
    }

    let refreshed = false;
    let testRes = await fetch('https://api.contaazul.com/v1/sales?page=0&size=1', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        }
    });

    if (testRes.status === 401) {
        console.log('[Debug] Token expired, attempting refresh...');
        const refreshedData = await refreshContaAzulToken();
        if (refreshedData) {
            token = refreshedData.accessToken;
            refreshed = true;
            testRes = await fetch('https://api.contaazul.com/v1/sales?page=0&size=1', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });
        }
    }

    const testBody = await testRes.text();

    const response = NextResponse.json({
        status: 'TOKEN_PROCESSED',
        refreshed,
        tokenPreview: `${token?.substring(0, 30)}...`,
        salesApiStatus: testRes.status,
        salesApiResponse: testBody.substring(0, 500),
        cookies: cookieStore.getAll().map(c => c.name)
    });

    // Se houve refresh no debug, também tentamos atualizar (embora o cookie manager no Next.js GET seja limitado)
    return response;
}
