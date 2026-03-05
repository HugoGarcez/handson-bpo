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
    let refreshAttempted = false;
    let refreshResponseDetails = null;

    // Função de teste
    const testApi = async (t: string) => {
        return await fetch('https://api.contaazul.com/v1/sales?page=0&size=1', {
            headers: {
                'Authorization': `Bearer ${t}`,
                'Content-Type': 'application/json',
            }
        });
    };

    let testRes = await testApi(token);

    if (testRes.status === 401) {
        refreshAttempted = true;
        console.log('[Debug] Token expired (401), attempting refresh...');
        const refreshedData = await refreshContaAzulToken();

        if (refreshedData) {
            token = refreshedData.accessToken;
            refreshed = true;
            refreshResponseDetails = {
                newTokenLength: token.length,
                newTokenPreview: `${token.substring(0, 20)}...`
            };
            // Retenta com o novo token
            testRes = await testApi(token);
        } else {
            refreshResponseDetails = "Refresh function returned null";
        }
    }

    const testBody = await testRes.text();

    const resultJson = {
        status: 'TOKEN_PROCESSED',
        initialTokenLength: cookieStore.get('contaazul_access_token')?.value.length,
        refreshAttempted,
        refreshed,
        refreshDetails: refreshResponseDetails,
        finalTokenPreview: `${token?.substring(0, 30)}...`,
        salesApiStatus: testRes.status,
        salesApiResponse: testBody.substring(0, 500),
        cookies: allCookies
    };

    const response = NextResponse.json(resultJson);

    // Se houve refresh, tenta setar os cookies na resposta (embora em GET de App Router seja limitado, ajudas nos logs)
    if (refreshed && token) {
        // Tenta persistir o novo token no navegador
        response.cookies.set('contaazul_access_token', token, {
            httpOnly: true,
            secure: true,
            path: '/',
            maxAge: 3600
        });
    }

    return response;
}
