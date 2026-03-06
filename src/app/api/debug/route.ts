import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshContaAzulToken } from '@/lib/token-utils';

export const dynamic = 'force-dynamic';

const CONTA_AZUL_API = 'https://api-v2.contaazul.com';

export async function GET() {
    const cookieStore = cookies();
    let token = cookieStore.get('contaazul_access_token')?.value;
    const allCookies = cookieStore.getAll().map(c => c.name);

    let refreshAttempted = false;
    let refreshed = false;
    let refreshDiagnostic: unknown = null;

    if (!token) {
        // Sem access_token - tentar refresh automático
        console.log('[Debug] No access_token found. Attempting automatic refresh...');
        refreshAttempted = true;
        const result = await refreshContaAzulToken();
        refreshDiagnostic = result;

        if (result.success && result.data) {
            token = result.data.accessToken;
            refreshed = true;
            console.log('[Debug] Token refreshed successfully!');
        } else {
            // Sem access_token e refresh falhou: retornar diagnóstico
            return NextResponse.json({
                status: 'NO_TOKEN_AND_REFRESH_FAILED',
                cookies: allCookies,
                refreshAttempted,
                refreshed,
                refreshDiagnostic,
                message: 'Precisa autenticar novamente em /api/auth/contaazul'
            });
        }
    }

    // Token em mãos - testar vários endpoints
    const makeTest = async (endpoint: string) => {
        try {
            const res = await fetch(`${CONTA_AZUL_API}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });
            const body = await res.text();
            return { status: res.status, body: body.substring(0, 200) };
        } catch (e) {
            return { status: 'error', body: String(e) };
        }
    };

    const [salesTest, receivablesTest, payablesTest, financialTest] = await Promise.all([
        makeTest('/v1/venda/busca?pagina=0&tamanhoPagina=1'),
        makeTest('/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?pagina=0&tamanhoPagina=1'),
        makeTest('/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?pagina=0&tamanhoPagina=1'),
        makeTest('/v1/conta-financeira'),
    ]);

    const responseData = {
        status: 'TOKEN_PROCESSED',
        tokenPreview: token?.substring(0, 30) + '...',
        tokenLength: token?.length,
        refreshAttempted,
        refreshed,
        refreshDiagnostic,
        cookies: allCookies,
        endpointTests: {
            sales: salesTest,
            receivables: receivablesTest,
            payables: payablesTest,
            financialAccounts: financialTest,
        }
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
