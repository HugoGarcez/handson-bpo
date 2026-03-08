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
        console.log('[Debug] Sem access_token. Tentando refresh...');
        refreshAttempted = true;
        const result = await refreshContaAzulToken();
        refreshDiagnostic = result;

        if (result.success && result.data) {
            token = result.data.accessToken;
            refreshed = true;
        } else {
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

    // Retorna JSON real completo (sem truncar) para diagnóstico de campos
    const makeTest = async (endpoint: string) => {
        try {
            const res = await fetch(`${CONTA_AZUL_API}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                }
            });
            const body = await res.text();
            let parsed: unknown = null;
            try { parsed = JSON.parse(body); } catch { /* ignore */ }
            return { status: res.status, rawBody: body.substring(0, 2000), parsed };
        } catch (e) {
            return { status: 'error', rawBody: String(e), parsed: null };
        }
    };

    // Testa endpoint via POST+JSON body
    const makePost = async (endpoint: string, bodyObj: Record<string, unknown>) => {
        try {
            const res = await fetch(`${CONTA_AZUL_API}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(bodyObj),
            });
            const body = await res.text();
            let parsed: unknown = null;
            try { parsed = JSON.parse(body); } catch { /* ignore */ }
            return { status: res.status, rawBody: body.substring(0, 2000), parsed };
        } catch (e) {
            return { status: 'error', rawBody: String(e), parsed: null };
        }
    };

    const today = new Date();
    const d90ago = new Date(today); d90ago.setDate(today.getDate() - 90);
    const d90fwd = new Date(today); d90fwd.setDate(today.getDate() + 90);
    const d30ago = new Date(today); d30ago.setDate(today.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const [salesTest, receivablesTest, payablesTest, financialTest] = await Promise.all([
        makeTest(`/v1/venda/busca?dataEmissaoInicio=${fmt(d30ago)}&dataEmissaoFim=${fmt(today)}&pagina=0&tamanhoPagina=3`),
        makePost(`/v1/financeiro/eventos-financeiros/contas-a-receber/buscar`, {
            data_vencimento_de: fmt(d90ago),
            data_vencimento_ate: fmt(d90fwd),
            pagina: 0,
            tamanhoPagina: 3,
        }),
        makePost(`/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar`, {
            data_vencimento_de: fmt(d90ago),
            data_vencimento_ate: fmt(d90fwd),
            pagina: 0,
            tamanhoPagina: 3,
        }),
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
        // Dados completos para diagnóstico de campos
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
