import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshContaAzulToken, TokenData } from '@/lib/token-utils';

// Força renderização dinâmica (necessário para cookies() funcionar)
export const dynamic = 'force-dynamic';

const CONTA_AZUL_API = 'https://api.contaazul.com';

// Interfaces para tipagem dos dados do Conta Azul
interface FinancialItem {
    value?: number;
    balance?: number;
}

interface ApiResponseData {
    data?: FinancialItem[];
}

// Busca dados reais do Conta Azul usando o token Bearer autenticado
async function fetchContaAzulData(token: string): Promise<{ context: string, newToken?: TokenData }> {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    let currentToken = token;
    let refreshedTokenData: TokenData | null = null;

    const makeRequest = async (endpoint: string) => {
        const headers = {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        let response = await fetch(`${CONTA_AZUL_API}${endpoint}`, { headers });

        // Se der 401 e ainda não tentamos dar refresh nesta requisição
        if (response.status === 401 && !refreshedTokenData) {
            console.log(`[ContaAzul] 401 detected on ${endpoint}. Attempting token refresh...`);
            const refreshResult = await refreshContaAzulToken();

            if (refreshResult.success && refreshResult.data) {
                refreshedTokenData = refreshResult.data;
                currentToken = refreshedTokenData.accessToken;
                // Tenta novamente com o novo token
                const newHeaders = {
                    ...headers,
                    'Authorization': `Bearer ${currentToken}`,
                };
                response = await fetch(`${CONTA_AZUL_API}${endpoint}`, { headers: newHeaders });
            }
        }
        return response;
    };

    const results: Record<string, unknown> = {};

    // 1. Vendas
    try {
        const res = await makeRequest(`/v1/sales?status=COMMITTED&emission_start=${dateFrom}&emission_end=${dateTo}&page=0&size=100`);
        const body = await res.text();
        if (res.ok) results.vendas = JSON.parse(body);
        else results.vendasErro = `Status ${res.status}: ${body.substring(0, 100)}`;
    } catch (e) { results.vendasErro = String(e); }

    // 2. Recebíveis
    try {
        const res = await makeRequest(`/v1/receivables?status=PENDING&page=0&size=50`);
        const body = await res.text();
        if (res.ok) results.contasReceber = JSON.parse(body);
        else results.contasReceberErro = `Status ${res.status}: ${body.substring(0, 100)}`;
    } catch (e) { results.contasReceberErro = String(e); }

    // 3. Pagáveis
    try {
        const res = await makeRequest(`/v1/payables?status=PENDING&page=0&size=50`);
        const body = await res.text();
        if (res.ok) results.contasPagar = JSON.parse(body);
        else results.contasPagarErro = `Status ${res.status}: ${body.substring(0, 100)}`;
    } catch (e) { results.contasPagarErro = String(e); }

    // 4. Saldo
    try {
        const res = await makeRequest(`/v1/financial-accounts?page=0&size=20`);
        const body = await res.text();
        if (res.ok) results.contasFinanceiras = JSON.parse(body);
        else results.contasFinanceirasErro = `Status ${res.status}: ${body.substring(0, 100)}`;
    } catch (e) { results.contasFinanceirasErro = String(e); }

    // Formatação do contexto para a IA
    let context = `DADOS REAIS DO CONTA AZUL (Última atualização: ${today.toLocaleString('pt-BR')}):\n\n`;

    // Processa Vendas
    if (results.vendas && typeof results.vendas === 'object') {
        const vendasData = results.vendas as ApiResponseData;
        const items = vendasData.data || (Array.isArray(results.vendas) ? (results.vendas as FinancialItem[]) : []);
        const total = items.reduce((sum: number, v: FinancialItem) => sum + (v.value || 0), 0);
        context += `📊 VENDAS (30 dias): ${items.length} transações | Total: R$ ${total.toFixed(2)}\n`;
    }

    // Processa Recebíveis
    if (results.contasReceber && typeof results.contasReceber === 'object') {
        const receberData = results.contasReceber as ApiResponseData;
        const items = receberData.data || (Array.isArray(results.contasReceber) ? (results.contasReceber as FinancialItem[]) : []);
        const total = items.reduce((sum: number, v: FinancialItem) => sum + (v.value || 0), 0);
        context += `💰 CONTAS A RECEBER: R$ ${total.toFixed(2)} (${items.length} pendentes)\n`;
    }

    // Processa Pagáveis
    if (results.contasPagar && typeof results.contasPagar === 'object') {
        const pagarData = results.contasPagar as ApiResponseData;
        const items = pagarData.data || (Array.isArray(results.contasPagar) ? (results.contasPagar as FinancialItem[]) : []);
        const total = items.reduce((sum: number, v: FinancialItem) => sum + (v.value || 0), 0);
        context += `📉 CONTAS A PAGAR: R$ ${total.toFixed(2)} (${items.length} pendentes)\n`;
    }

    // Processa Saldo
    if (results.contasFinanceiras && typeof results.contasFinanceiras === 'object') {
        const finData = results.contasFinanceiras as ApiResponseData;
        const items = finData.data || (Array.isArray(results.contasFinanceiras) ? (results.contasFinanceiras as FinancialItem[]) : []);
        const total = items.reduce((sum: number, c: FinancialItem) => sum + (c.balance || 0), 0);
        context += `🏦 SALDO TOTAL: R$ ${total.toFixed(2)}\n`;
    }

    return { context, newToken: refreshedTokenData };
}

export async function POST(req: NextRequest) {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
        apiKey: process.env.THESYS_API_KEY || 'missing-key',
        baseURL: 'https://api.thesys.dev/v1/embed',
    });

    try {
        const { messages } = await req.json();
        const cookieStore = cookies();
        const token = cookieStore.get('contaazul_access_token')?.value;

        let financialContext = 'O usuário não autenticou o Conta Azul.';
        let refreshedData: TokenData | undefined = undefined;

        if (token) {
            const result = await fetchContaAzulData(token);
            financialContext = result.context;
            refreshedData = result.newToken;
        }

        const systemPrompt = `Você é um assistente financeiro premium integrado ao Conta Azul. Responda em português do Brasil.
Aja com base nos dados REAIS fornecidos abaixo. Se não houver dados, peça para o usuário conectar a conta.

${financialContext}`;

        const chatStream = await openai.chat.completions.create({
            model: 'c1/anthropic/claude-sonnet-4/v-20251230',
            stream: true,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
        });

        const readableStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of chatStream) {
                        const text = chunk.choices[0]?.delta?.content || '';
                        if (text) controller.enqueue(encoder.encode(text));
                    }
                } catch (e) {
                    console.error('Stream error:', e);
                } finally {
                    controller.close();
                }
            },
        });

        const response = new Response(readableStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
            },
        });

        // Se houve refresh, atualizamos os cookies na resposta
        if (refreshedData) {
            response.headers.append('Set-Cookie', `contaazul_access_token=${refreshedData.accessToken}; HttpOnly; Secure; Path=/; Max-Age=${refreshedData.expiresIn}`);
            if (refreshedData.refreshToken) {
                response.headers.append('Set-Cookie', `contaazul_refresh_token=${refreshedData.refreshToken}; HttpOnly; Secure; Path=/; Max-Age=${30 * 24 * 60 * 60}`);
            }
        }

        return response;

    } catch (error) {
        console.error('TheSys Chat API Error:', error);
        return NextResponse.json({ error: 'Erro na comunicação com a IA.' }, { status: 500 });
    }
}
