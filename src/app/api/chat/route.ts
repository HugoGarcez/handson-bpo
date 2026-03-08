import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshContaAzulToken, TokenData } from '@/lib/token-utils';

// Força renderização dinâmica (necessário para cookies() funcionar)
export const dynamic = 'force-dynamic';

const CONTA_AZUL_API = 'https://api-v2.contaazul.com';

// Interfaces para tipagem dos dados da nova API v2 do Conta Azul
interface VendaItem {
    valor_total?: number;
    numero?: number;
    status?: string;
    cliente?: { nome?: string };
}
interface ContaFinanceira {
    id?: string;
    nome?: string;
    banco?: string;
    saldo_atual?: number;
    ativo?: boolean;
    tipo?: string;
}
interface ContasFinanceirasResponse {
    itens?: ContaFinanceira[];
    itens_totais?: number;
}
interface EventoFinanceiroItem {
    valor?: number;
    valor_pendente?: number;
    data_vencimento?: string;
    descricao?: string;
    status?: string;
}

// Busca dados reais do Conta Azul usando o token Bearer autenticado
async function fetchContaAzulData(token: string): Promise<{ context: string; newToken?: TokenData }> {
    const today = new Date();

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);

    const ninetyDaysAhead = new Date(today);
    ninetyDaysAhead.setDate(today.getDate() + 90);

    const dateFrom30 = thirtyDaysAgo.toISOString().split('T')[0];
    const dateFrom90 = ninetyDaysAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];
    const dateTo90Ahead = ninetyDaysAhead.toISOString().split('T')[0];

    let currentToken = token;
    let refreshedTokenData: TokenData | undefined = undefined;

    // Faz requisição com suporte a refresh automático de token em caso de 401
    const makeRequest = async (endpoint: string): Promise<Response> => {
        const headers = {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        let response = await fetch(`${CONTA_AZUL_API}${endpoint}`, { headers });

        if (response.status === 401 && !refreshedTokenData) {
            console.log(`[ContaAzul] 401 em ${endpoint}. Tentando refresh do token...`);
            const refreshResult = await refreshContaAzulToken();
            if (refreshResult.success && refreshResult.data) {
                refreshedTokenData = refreshResult.data;
                currentToken = refreshedTokenData.accessToken;
                response = await fetch(`${CONTA_AZUL_API}${endpoint}`, {
                    headers: { ...headers, 'Authorization': `Bearer ${currentToken}` },
                });
            }
        }
        return response;
    };

    // Paginação automática: varre TODAS as páginas até esgotar os registros
    const fetchAllPages = async <T>(
        buildEndpoint: (page: number, pageSize: number) => string,
        pageSize = 200
    ): Promise<T[]> => {
        let page = 0;
        const allItems: T[] = [];

        while (true) {
            const endpoint = buildEndpoint(page, pageSize);
            console.log(`[ContaAzul] Página ${page}: ${endpoint}`);

            let res: Response;
            try {
                res = await makeRequest(endpoint);
            } catch (e) {
                console.error(`[ContaAzul] Erro de rede na página ${page}:`, e);
                break;
            }

            if (!res.ok) {
                const body = await res.text();
                console.warn(`[ContaAzul] Erro HTTP ${res.status} na página ${page}: ${body.substring(0, 200)}`);
                break;
            }

            const data = await res.json();
            const itens: T[] = Array.isArray(data.itens) ? data.itens : [];
            allItems.push(...itens);

            console.log(`[ContaAzul] Pág ${page}: ${itens.length} itens | Total acumulado: ${allItems.length}`);

            // Para quando não há mais itens ou chegou na última página (menos itens que o tamanho solicitado)
            if (itens.length === 0 || itens.length < pageSize) break;

            // Proteção contra loops infinitos: máximo 20 páginas (= 4000 registros com pageSize 200)
            if (page >= 19) {
                console.warn(`[ContaAzul] Limite de 20 páginas atingido. Parando paginação.`);
                break;
            }

            page++;
        }

        return allItems;
    };

    // 1. Vendas — últimos 30 dias (foco operacional)
    let vendasItens: VendaItem[] = [];
    let vendasErro: string | undefined;
    try {
        vendasItens = await fetchAllPages<VendaItem>(
            (page, size) =>
                `/v1/venda/busca?dataEmissaoInicio=${dateFrom30}&dataEmissaoFim=${dateTo}&pagina=${page}&tamanhoPagina=${size}`
        );
    } catch (e) {
        vendasErro = String(e);
    }

    // 2. Contas a Receber — 90 dias passados a 90 dias futuros
    let receberItens: EventoFinanceiroItem[] = [];
    let receberErro: string | undefined;
    try {
        receberItens = await fetchAllPages<EventoFinanceiroItem>(
            (page, size) =>
                `/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?data_vencimento_de=${dateFrom90}&data_vencimento_ate=${dateTo90Ahead}&pagina=${page}&tamanhoPagina=${size}`
        );
    } catch (e) {
        receberErro = String(e);
    }

    // 3. Contas a Pagar — 90 dias passados a 90 dias futuros
    let pagarItens: EventoFinanceiroItem[] = [];
    let pagarErro: string | undefined;
    try {
        pagarItens = await fetchAllPages<EventoFinanceiroItem>(
            (page, size) =>
                `/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?data_vencimento_de=${dateFrom90}&data_vencimento_ate=${dateTo90Ahead}&pagina=${page}&tamanhoPagina=${size}`
        );
    } catch (e) {
        pagarErro = String(e);
    }

    // 4. Contas Financeiras / Saldo (endpoint único, sem paginação necessária)
    let contasFinanceiras: ContasFinanceirasResponse | undefined;
    let contasFinanceirasErro: string | undefined;
    try {
        const res = await makeRequest(`/v1/conta-financeira`);
        const body = await res.text();
        if (res.ok) {
            contasFinanceiras = JSON.parse(body);
        } else {
            contasFinanceirasErro = `Status ${res.status}: ${body.substring(0, 150)}`;
        }
    } catch (e) {
        contasFinanceirasErro = String(e);
    }

    // Formatação do contexto para a IA
    let context = `DADOS REAIS DO CONTA AZUL (Atualizado em: ${today.toLocaleString('pt-BR')}):\n\n`;

    // Vendas
    if (vendasErro) {
        context += `📊 VENDAS: Erro ao buscar (${vendasErro})\n`;
    } else {
        const totalFaturado = vendasItens.reduce((s, i) => s + (i.valor_total ?? 0), 0);
        const aprovadas = vendasItens.filter(i => i.status === 'APROVADO');
        const totalAprovado = aprovadas.reduce((s, i) => s + (i.valor_total ?? 0), 0);

        context += `📊 VENDAS (últimos 30 dias) — ${vendasItens.length} registros:\n`;
        context += `  - Total faturado: R$ ${totalFaturado.toFixed(2)}\n`;
        context += `  - Aprovadas: ${aprovadas.length} | R$ ${totalAprovado.toFixed(2)}\n`;

        if (vendasItens.length > 0) {
            context += `  - Detalhes:\n`;
            vendasItens.forEach(item => {
                context += `    • Venda #${item.numero ?? '?'} | ${item.cliente?.nome ?? 'Cliente'} | R$ ${(item.valor_total ?? 0).toFixed(2)} | ${item.status ?? ''}\n`;
            });
        }
    }

    // Contas a Receber
    if (receberErro) {
        context += `💰 CONTAS A RECEBER: Erro ao buscar (${receberErro})\n`;
    } else {
        const pendentes = receberItens.filter(i => i.status !== 'PAGO');
        const vencidos = pendentes.filter(i => i.data_vencimento && i.data_vencimento < dateTo);
        const totalGeral = receberItens.reduce((s, i) => s + (i.valor ?? 0), 0);
        const totalPendente = pendentes.reduce((s, i) => s + (i.valor_pendente ?? i.valor ?? 0), 0);

        context += `💰 CONTAS A RECEBER (90 dias) — ${receberItens.length} registros:\n`;
        context += `  - Valor total: R$ ${totalGeral.toFixed(2)} | Pendente: R$ ${totalPendente.toFixed(2)}\n`;
        context += `  - Vencidos e não pagos: ${vencidos.length}\n`;

        if (receberItens.length > 0) {
            context += `  - Detalhes:\n`;
            receberItens.forEach(item => {
                context += `    • ${item.descricao ?? 'Recebível'} | R$ ${(item.valor_pendente ?? item.valor ?? 0).toFixed(2)} | Vence: ${item.data_vencimento ?? '?'} | ${item.status ?? ''}\n`;
            });
        }
    }

    // Contas a Pagar
    if (pagarErro) {
        context += `📉 CONTAS A PAGAR: Erro ao buscar (${pagarErro})\n`;
    } else {
        const pendentes = pagarItens.filter(i => i.status !== 'PAGO');
        const vencidos = pendentes.filter(i => i.data_vencimento && i.data_vencimento < dateTo);
        const totalGeral = pagarItens.reduce((s, i) => s + (i.valor ?? 0), 0);
        const totalPendente = pendentes.reduce((s, i) => s + (i.valor_pendente ?? i.valor ?? 0), 0);

        context += `📉 CONTAS A PAGAR (90 dias) — ${pagarItens.length} registros:\n`;
        context += `  - Valor total: R$ ${totalGeral.toFixed(2)} | Pendente: R$ ${totalPendente.toFixed(2)}\n`;
        context += `  - Vencidos e não pagos: ${vencidos.length}\n`;

        if (pagarItens.length > 0) {
            context += `  - Detalhes:\n`;
            pagarItens.forEach(item => {
                context += `    • ${item.descricao ?? 'Pagável'} | R$ ${(item.valor_pendente ?? item.valor ?? 0).toFixed(2)} | Vence: ${item.data_vencimento ?? '?'} | ${item.status ?? ''}\n`;
            });
        }
    }

    // Saldo em Contas Financeiras
    if (contasFinanceirasErro) {
        context += `🏦 SALDO: Erro ao buscar (${contasFinanceirasErro})\n`;
    } else if (contasFinanceiras) {
        const ativas = (contasFinanceiras.itens ?? []).filter(c => c.ativo !== false);
        const saldoTotal = ativas.reduce((s, c) => s + (c.saldo_atual ?? 0), 0);
        context += `🏦 SALDO TOTAL (contas ativas): R$ ${saldoTotal.toFixed(2)}\n`;
        ativas.forEach(c => {
            context += `  • ${c.nome ?? c.banco ?? 'Conta'} (${c.tipo ?? ''}): R$ ${(c.saldo_atual ?? 0).toFixed(2)}\n`;
        });
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
            console.log('[Chat] Sem access_token, tentando refresh...');
            const refreshResult = await refreshContaAzulToken();
            if (refreshResult.success && refreshResult.data) {
                console.log('[Chat] Refresh bem-sucedido, buscando dados...');
                refreshedData = refreshResult.data;
                const result = await fetchContaAzulData(refreshResult.data.accessToken);
                financialContext = result.context;
                if (result.newToken) refreshedData = result.newToken;
            } else {
                console.log('[Chat] Refresh falhou:', refreshResult.error);
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

        // Se houve refresh, atualiza os cookies na resposta
        if (refreshedData) {
            response.headers.append(
                'Set-Cookie',
                `contaazul_access_token=${refreshedData.accessToken}; HttpOnly; Secure; Path=/; Max-Age=${refreshedData.expiresIn}`
            );
            if (refreshedData.refreshToken) {
                response.headers.append(
                    'Set-Cookie',
                    `contaazul_refresh_token=${refreshedData.refreshToken}; HttpOnly; Secure; Path=/; Max-Age=${30 * 24 * 60 * 60}`
                );
            }
        }

        return response;

    } catch (error) {
        console.error('TheSys Chat API Error:', error);
        return NextResponse.json({ error: 'Erro na comunicação com a IA.' }, { status: 500 });
    }
}
