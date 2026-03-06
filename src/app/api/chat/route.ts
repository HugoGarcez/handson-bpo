import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshContaAzulToken, TokenData } from '@/lib/token-utils';

// Força renderização dinâmica (necessário para cookies() funcionar)
export const dynamic = 'force-dynamic';

const CONTA_AZUL_API = 'https://api-v2.contaazul.com';

// Interfaces para tipagem dos dados da nova API v2 do Conta Azul
interface VendasResponse {
    totais?: { total?: number; aprovado?: number; cancelado?: number; esperando_aprovacao?: number; };
    quantidades?: { total?: number; aprovado?: number; };
    itens?: Array<{ valor_total?: number; numero?: number; status?: string; cliente?: { nome?: string }; }>;
}
interface ContasFinanceirasResponse {
    itens?: Array<{ id?: string; nome?: string; banco?: string; saldo_atual?: number; ativo?: boolean; tipo?: string; }>;
    itens_totais?: number;
}
interface EventosFinanceirosResponse {
    itens?: Array<{ valor?: number; valor_pendente?: number; data_vencimento?: string; descricao?: string; status?: string; }>;
    totais?: { total?: number; pendente?: number; pago?: number; };
    itens_totais?: number;
}

// Busca dados reais do Conta Azul usando o token Bearer autenticado
async function fetchContaAzulData(token: string): Promise<{ context: string, newToken?: TokenData }> {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    let currentToken = token;
    let refreshedTokenData: TokenData | undefined = undefined;

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

    // 1. Vendas (nova API v2)
    try {
        const res = await makeRequest(`/v1/venda/busca?dataEmissaoInicio=${dateFrom}&dataEmissaoFim=${dateTo}&pagina=0&tamanhoPagina=100`);
        const body = await res.text();
        if (res.ok) results.vendas = JSON.parse(body);
        else results.vendasErro = `Status ${res.status}: ${body.substring(0, 150)}`;
    } catch (e) { results.vendasErro = String(e); }

    // 2. Contas a Receber (nova API v2 — parâmetros obrigatórios de data)
    try {
        const res = await makeRequest(`/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?data_vencimento_de=${dateFrom}&data_vencimento_ate=${dateTo}&pagina=0&tamanhoPagina=50`);
        const body = await res.text();
        if (res.ok) results.contasReceber = JSON.parse(body);
        else results.contasReceberErro = `Status ${res.status}: ${body.substring(0, 150)}`;
    } catch (e) { results.contasReceberErro = String(e); }

    // 3. Contas a Pagar (nova API v2 — parâmetros obrigatórios de data)
    try {
        const res = await makeRequest(`/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?data_vencimento_de=${dateFrom}&data_vencimento_ate=${dateTo}&pagina=0&tamanhoPagina=50`);
        const body = await res.text();
        if (res.ok) results.contasPagar = JSON.parse(body);
        else results.contasPagarErro = `Status ${res.status}: ${body.substring(0, 150)}`;
    } catch (e) { results.contasPagarErro = String(e); }

    // 4. Contas Financeiras / Saldo (nova API v2)
    try {
        const res = await makeRequest(`/v1/conta-financeira`);
        const body = await res.text();
        if (res.ok) results.contasFinanceiras = JSON.parse(body);
        else results.contasFinanceirasErro = `Status ${res.status}: ${body.substring(0, 150)}`;
    } catch (e) { results.contasFinanceirasErro = String(e); }

    // Formatação do contexto para a IA — baseado na nova estrutura da API v2
    let context = `DADOS REAIS DO CONTA AZUL (Última atualização: ${today.toLocaleString('pt-BR')}):\n\n`;

    // Processa Vendas (nova estrutura: totais.total, quantidades.total)
    if (results.vendas && typeof results.vendas === 'object') {
        const v = results.vendas as VendasResponse;
        const totalGeral = v.totais?.total ?? 0;
        const qtdTotal = v.quantidades?.total ?? 0;
        const qtdAprovado = v.quantidades?.aprovado ?? 0;
        const totalAprovado = v.totais?.aprovado ?? 0;
        context += `📊 VENDAS (30 dias):\n`;
        context += `  - Total de vendas: ${qtdTotal} | Total: R$ ${totalGeral.toFixed(2)}\n`;
        context += `  - Aprovadas: ${qtdAprovado} | R$ ${totalAprovado.toFixed(2)}\n`;
        // Listar até 10 vendas individuais se disponível
        if (v.itens && v.itens.length > 0) {
            context += `  - Últimas vendas:\n`;
            v.itens.slice(0, 10).forEach(item => {
                context += `    • Venda #${item.numero || '?'} | ${item.cliente?.nome || 'Cliente'} | R$ ${(item.valor_total || 0).toFixed(2)} | ${item.status || ''}\n`;
            });
        }
    } else if (results.vendasErro) {
        context += `📊 VENDAS: Erro ao buscar (${results.vendasErro})\n`;
    }

    // Processa Contas a Receber (nova estrutura: itens[].valor, totais)
    if (results.contasReceber && typeof results.contasReceber === 'object') {
        const r = results.contasReceber as EventosFinanceirosResponse;
        const totalPendente = r.totais?.pendente ?? r.itens?.reduce((s, i) => s + (i.valor_pendente ?? i.valor ?? 0), 0) ?? 0;
        const count = r.itens_totais ?? r.itens?.length ?? 0;
        context += `💰 CONTAS A RECEBER: R$ ${totalPendente.toFixed(2)} (${count} títulos)\n`;
        if (r.itens && r.itens.length > 0) {
            r.itens.slice(0, 5).forEach(item => {
                context += `  • ${item.descricao || 'Recebível'} | R$ ${(item.valor_pendente ?? item.valor ?? 0).toFixed(2)} | Vence: ${item.data_vencimento || '?'} | ${item.status || ''}\n`;
            });
        }
    } else if (results.contasReceberErro) {
        context += `💰 CONTAS A RECEBER: Erro ao buscar (${results.contasReceberErro})\n`;
    }

    // Processa Contas a Pagar (nova estrutura: itens[].valor, totais)
    if (results.contasPagar && typeof results.contasPagar === 'object') {
        const p = results.contasPagar as EventosFinanceirosResponse;
        const totalPendente = p.totais?.pendente ?? p.itens?.reduce((s, i) => s + (i.valor_pendente ?? i.valor ?? 0), 0) ?? 0;
        const count = p.itens_totais ?? p.itens?.length ?? 0;
        context += `📉 CONTAS A PAGAR: R$ ${totalPendente.toFixed(2)} (${count} títulos)\n`;
        if (p.itens && p.itens.length > 0) {
            p.itens.slice(0, 5).forEach(item => {
                context += `  • ${item.descricao || 'Pagável'} | R$ ${(item.valor_pendente ?? item.valor ?? 0).toFixed(2)} | Vence: ${item.data_vencimento || '?'} | ${item.status || ''}\n`;
            });
        }
    } else if (results.contasPagarErro) {
        context += `📉 CONTAS A PAGAR: Erro ao buscar (${results.contasPagarErro})\n`;
    }

    // Processa Contas Financeiras (nova estrutura: itens[].saldo_atual)
    if (results.contasFinanceiras && typeof results.contasFinanceiras === 'object') {
        const f = results.contasFinanceiras as ContasFinanceirasResponse;
        const ativas = (f.itens || []).filter(c => c.ativo !== false);
        const saldoTotal = ativas.reduce((s, c) => s + (c.saldo_atual ?? 0), 0);
        context += `🏦 SALDO TOTAL (contas ativas): R$ ${saldoTotal.toFixed(2)}\n`;
        ativas.forEach(c => {
            context += `  • ${c.nome || c.banco || 'Conta'} (${c.tipo || ''}): R$ ${(c.saldo_atual ?? 0).toFixed(2)}\n`;
        });
    } else if (results.contasFinanceirasErro) {
        context += `🏦 SALDO: Erro ao buscar (${results.contasFinanceirasErro})\n`;
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

        let financialContext = 'O usuário não autenticou o Conta Azul. Peça para o usuário visitar /api/auth/contaazul para conectar.';
        let refreshedData: TokenData | undefined = undefined;

        if (token) {
            const result = await fetchContaAzulData(token);
            financialContext = result.context;
            refreshedData = result.newToken;
        } else {
            // Sem access_token - tentar usar o refresh_token para obter um novo
            console.log('[Chat] No access_token found, attempting refresh...');
            const refreshResult = await refreshContaAzulToken();
            if (refreshResult.success && refreshResult.data) {
                console.log('[Chat] Refresh successful, fetching data with new token');
                refreshedData = refreshResult.data;
                const result = await fetchContaAzulData(refreshResult.data.accessToken);
                financialContext = result.context;
                if (result.newToken) refreshedData = result.newToken;
            } else {
                console.log('[Chat] Refresh failed:', refreshResult.error);
            }
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
