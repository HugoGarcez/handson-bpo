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
    let refreshDiagnostic = null;

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
        const result = await refreshContaAzulToken();
        refreshDiagnostic = result;

        if (result.success && result.data) {
            token = result.data.accessToken;
            refreshed = true;
            testRes = await testApi(token);
        }
    }

    const testBody = await testRes.text();

    const responseData = {
        status: 'TOKEN_PROCESSED',
        initialTokenLength: cookieStore.get('contaazul_access_token')?.value?.length,
        refreshAttempted,
        refreshed,
        refreshDiagnostic,
        salesApiStatus: testRes.status,
        salesApiResponse: testBody.substring(0, 500),
        cookies: allCookies
    };

    const response = NextResponse.json(responseData);

    if (refreshed && token) {
        response.cookies.set('contaazul_access_token', token, {
            httpOnly: true,
            secure: true,
            path: '/',
            maxAge: 3600
        });
    }

    return response;
}
