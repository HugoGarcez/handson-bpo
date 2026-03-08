import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshContaAzulToken, TokenData } from '@/lib/token-utils';

// Força renderização dinâmica (necessário para cookies() funcionar)
export const dynamic = 'force-dynamic';

const CONTA_AZUL_API = 'https://api-v2.contaazul.com';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos mínimos para tipagem segura
// ──────────────────────────────────────────────────────────────────────────────
interface ContaFinanceira {
    id?: string;
    nome?: string;
    banco?: string;
    saldo_atual?: number;
    ativo?: boolean;
    tipo?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Busca dados reais do Conta Azul
// ──────────────────────────────────────────────────────────────────────────────
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

    // Faz requisição com refresh automático em caso de 401
    const makeRequest = async (url: string): Promise<Response> => {
        const headers = {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        let response = await fetch(url, { headers });

        if (response.status === 401 && !refreshedTokenData) {
            console.log(`[ContaAzul] 401 detectado. Tentando refresh do token...`);
            const refreshResult = await refreshContaAzulToken();
            if (refreshResult.success && refreshResult.data) {
                refreshedTokenData = refreshResult.data;
                currentToken = refreshedTokenData.accessToken;
                response = await fetch(url, {
                    headers: { ...headers, 'Authorization': `Bearer ${currentToken}` },
                });
            }
        }
        return response;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // fetchAllPages: varre todas as páginas PRESERVANDO os totais da raiz
    // A API retorna totais agregados no nível raiz da resposta (não nos itens).
    // Por isso salvamos os `totais` da PRIMEIRA página (já representam o total
    // do período completo, independente de paginação).
    // ─────────────────────────────────────────────────────────────────────────
    const fetchAllPages = async (
        buildUrl: (page: number, size: number) => string,
        pageSize = 200
    ): Promise<{
        itens: Record<string, unknown>[];
        totais: Record<string, unknown>;
        itensTotais: number;
    }> => {
        let page = 0;
        const allItems: Record<string, unknown>[] = [];
        // totais vêm da raiz e representam o período todo (não só a página)
        let rootTotais: Record<string, unknown> = {};
        let itensTotais = 0;

        while (true) {
            const url = buildUrl(page, pageSize);
            console.log(`[ContaAzul] GET pag=${page}: ${url}`);

            let res: Response;
            try {
                res = await makeRequest(url);
            } catch (e) {
                console.error(`[ContaAzul] Erro de rede na pag ${page}:`, e);
                break;
            }

            if (!res.ok) {
                const errBody = await res.text();
                console.warn(`[ContaAzul] HTTP ${res.status} na pag ${page}: ${errBody.substring(0, 300)}`);
                break;
            }

            const data: Record<string, unknown> = await res.json();

            // Grava totais da raiz apenas na primeira página
            if (page === 0) {
                if (data.totais && typeof data.totais === 'object') {
                    rootTotais = data.totais as Record<string, unknown>;
                }
                if (typeof data.itens_totais === 'number') {
                    itensTotais = data.itens_totais;
                }
            }

            const itens = Array.isArray(data.itens) ? (data.itens as Record<string, unknown>[]) : [];
            allItems.push(...itens);

            console.log(`[ContaAzul] pag ${page}: ${itens.length} itens | acumulado: ${allItems.length}`);

            // Critério de parada: última página ou sem itens
            if (itens.length === 0 || itens.length < pageSize) break;
            if (page >= 19) {
                console.warn(`[ContaAzul] Limite de 20 páginas atingido.`);
                break;
            }

            page++;
        }

        if (itensTotais === 0) itensTotais = allItems.length;
        return { itens: allItems, totais: rootTotais, itensTotais };
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 1. VENDAS — últimos 30 dias
    // ─────────────────────────────────────────────────────────────────────────
    let vendasData: Awaited<ReturnType<typeof fetchAllPages>> | null = null;
    let vendasErro: string | undefined;
    try {
        vendasData = await fetchAllPages(
            (page, size) =>
                `${CONTA_AZUL_API}/v1/venda/busca?dataEmissaoInicio=${dateFrom30}&dataEmissaoFim=${dateTo}&pagina=${page}&tamanhoPagina=${size}`
        );
    } catch (e) {
        vendasErro = String(e);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CONTAS A RECEBER — 90 dias passados a 90 dias futuros
    // ─────────────────────────────────────────────────────────────────────────
    let receberData: Awaited<ReturnType<typeof fetchAllPages>> | null = null;
    let receberErro: string | undefined;
    try {
        receberData = await fetchAllPages(
            (page, size) =>
                `${CONTA_AZUL_API}/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?data_vencimento_de=${dateFrom90}&data_vencimento_ate=${dateTo90Ahead}&pagina=${page}&tamanhoPagina=${size}`
        );
    } catch (e) {
        receberErro = String(e);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CONTAS A PAGAR — 90 dias passados a 90 dias futuros
    // ─────────────────────────────────────────────────────────────────────────
    let pagarData: Awaited<ReturnType<typeof fetchAllPages>> | null = null;
    let pagarErro: string | undefined;
    try {
        pagarData = await fetchAllPages(
            (page, size) =>
                `${CONTA_AZUL_API}/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?data_vencimento_de=${dateFrom90}&data_vencimento_ate=${dateTo90Ahead}&pagina=${page}&tamanhoPagina=${size}`
        );
    } catch (e) {
        pagarErro = String(e);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CONTAS FINANCEIRAS / SALDO (endpoint único, sem paginação)
    // ─────────────────────────────────────────────────────────────────────────
    let contasFinanceiras: { itens?: ContaFinanceira[] } | undefined;
    let contasFinanceirasErro: string | undefined;
    try {
        const res = await makeRequest(`${CONTA_AZUL_API}/v1/conta-financeira`);
        const body = await res.text();
        if (res.ok) {
            contasFinanceiras = JSON.parse(body);
        } else {
            contasFinanceirasErro = `Status ${res.status}: ${body.substring(0, 150)}`;
        }
    } catch (e) {
        contasFinanceirasErro = String(e);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Monta contexto para a IA
    // Usa os totais da RAIZ da resposta sempre que disponíveis (são os valores
    // reais e corretos do período, calculados pela Conta Azul).
    // Para os itens, usa campos genéricos com fallbacks para cobrir variações
    // de nome de campo entre endpoints da API.
    // ─────────────────────────────────────────────────────────────────────────
    const n = (v: unknown): number => (typeof v === 'number' ? v : 0);
    const s = (v: unknown): string => (typeof v === 'string' ? v : '');
    const fmt = (v: unknown) => `R$ ${n(v).toFixed(2)}`;

    let context = `DADOS REAIS DO CONTA AZUL (Atualizado em: ${today.toLocaleString('pt-BR')}):\n\n`;

    // ── Vendas ──
    if (vendasErro) {
        context += `📊 VENDAS: Erro ao buscar (${vendasErro})\n`;
    } else if (vendasData) {
        const t = vendasData.totais;
        // totais da raiz: os campos exatos dependem da versão da API
        // tentamos várias variações para ser robusto
        const totalValor = n(t.total) || n(t.valor_total) || n(t.faturamento);
        const totalAprov = n(t.aprovado) || n(t.valor_aprovado);
        const qtdTotal = n(t.quantidade_total) || n((t.quantidades as Record<string, unknown>)?.total) || vendasData.itensTotais;
        const qtdAprov = n((t.quantidades as Record<string, unknown>)?.aprovado) || n(t.quantidade_aprovada);

        context += `📊 VENDAS (últimos 30 dias):\n`;
        context += `  - Quantidade total: ${qtdTotal} vendas\n`;
        context += `  - Valor total faturado: ${fmt(totalValor)}\n`;
        if (totalAprov > 0 || qtdAprov > 0) {
            context += `  - Aprovadas: ${qtdAprov} vendas | ${fmt(totalAprov)}\n`;
        }

        if (vendasData.itens.length > 0) {
            context += `  - Lista de vendas:\n`;
            vendasData.itens.forEach(item => {
                // tenta vários nomes de campo para valor
                const valor = n(item.valor_total) || n(item.valor) || n(item.total);
                const numero = item.numero ?? item.id ?? '?';
                const cliente = (item.cliente as Record<string, unknown>)?.nome ?? item.cliente ?? '-';
                const status = s(item.status);
                context += `    • Venda #${numero} | ${cliente} | ${fmt(valor)} | ${status}\n`;
            });
        }
    }

    // ── Contas a Receber ──
    if (receberErro) {
        context += `💰 CONTAS A RECEBER: Erro ao buscar (${receberErro})\n`;
    } else if (receberData) {
        const t = receberData.totais;
        const totalGeral = n(t.total) || n(t.valor_total);
        const totalPendente = n(t.pendente) || n(t.valor_pendente) || n(t.a_receber);

        context += `💰 CONTAS A RECEBER (90 dias):\n`;
        context += `  - Total de títulos: ${receberData.itensTotais}\n`;
        context += `  - Valor total: ${fmt(totalGeral || receberData.itens.reduce((s, i) => s + n(i.valor), 0))}\n`;
        context += `  - Valor pendente: ${fmt(totalPendente || receberData.itens.filter(i => s(i.status) !== 'PAGO').reduce((s, i) => s + (n(i.valor_pendente) || n(i.valor)), 0))}\n`;

        if (receberData.itens.length > 0) {
            context += `  - Títulos:\n`;
            receberData.itens.forEach(item => {
                const valor = n(item.valor_pendente) || n(item.valor);
                const desc = s(item.descricao) || s(item.nome) || 'Recebível';
                const venc = s(item.data_vencimento) || s(item.vencimento) || '?';
                const status = s(item.status);
                context += `    • ${desc} | ${fmt(valor)} | Vence: ${venc} | ${status}\n`;
            });
        }
    }

    // ── Contas a Pagar ──
    if (pagarErro) {
        context += `📉 CONTAS A PAGAR: Erro ao buscar (${pagarErro})\n`;
    } else if (pagarData) {
        const t = pagarData.totais;
        const totalGeral = n(t.total) || n(t.valor_total);
        const totalPendente = n(t.pendente) || n(t.valor_pendente) || n(t.a_pagar);

        context += `📉 CONTAS A PAGAR (90 dias):\n`;
        context += `  - Total de títulos: ${pagarData.itensTotais}\n`;
        context += `  - Valor total: ${fmt(totalGeral || pagarData.itens.reduce((s, i) => s + n(i.valor), 0))}\n`;
        context += `  - Valor pendente: ${fmt(totalPendente || pagarData.itens.filter(i => s(i.status) !== 'PAGO').reduce((s, i) => s + (n(i.valor_pendente) || n(i.valor)), 0))}\n`;

        if (pagarData.itens.length > 0) {
            context += `  - Títulos:\n`;
            pagarData.itens.forEach(item => {
                const valor = n(item.valor_pendente) || n(item.valor);
                const desc = s(item.descricao) || s(item.nome) || 'Pagável';
                const venc = s(item.data_vencimento) || s(item.vencimento) || '?';
                const status = s(item.status);
                context += `    • ${desc} | ${fmt(valor)} | Vence: ${venc} | ${status}\n`;
            });
        }
    }

    // ── Saldo / Contas Financeiras ──
    if (contasFinanceirasErro) {
        context += `🏦 SALDO: Erro ao buscar (${contasFinanceirasErro})\n`;
    } else if (contasFinanceiras) {
        const ativas = (contasFinanceiras.itens ?? []).filter(c => c.ativo !== false);
        const saldoTotal = ativas.reduce((acc, c) => acc + (c.saldo_atual ?? 0), 0);
        context += `🏦 SALDO TOTAL (contas ativas): ${fmt(saldoTotal)}\n`;
        ativas.forEach(c => {
            context += `  • ${c.nome ?? c.banco ?? 'Conta'} (${c.tipo ?? ''}): ${fmt(c.saldo_atual)}\n`;
        });
    }

    // Adiciona log do contexto gerado para facilitar debug no servidor
    console.log('[ContaAzul] Contexto gerado para IA:\n' + context);

    return { context, newToken: refreshedTokenData };
}

// ──────────────────────────────────────────────────────────────────────────────
// POST handler — recebe mensagens do chat e responde com streaming
// ──────────────────────────────────────────────────────────────────────────────
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
            // Sem access_token — tenta refresh automático
            console.log('[Chat] Sem access_token, tentando refresh...');
            const refreshResult = await refreshContaAzulToken();
            if (refreshResult.success && refreshResult.data) {
                console.log('[Chat] Refresh OK, buscando dados...');
                refreshedData = refreshResult.data;
                const result = await fetchContaAzulData(refreshResult.data.accessToken);
                financialContext = result.context;
                if (result.newToken) refreshedData = result.newToken;
            } else {
                console.log('[Chat] Refresh falhou:', refreshResult.error);
            }
        }

        const systemPrompt = `Você é um assistente financeiro integrado ao Conta Azul ERP. Responda SEMPRE em português do Brasil.

REGRAS OBRIGATÓRIAS:
- Use APENAS os dados fornecidos abaixo. NUNCA invente, estime ou suponha valores.
- Se um valor estiver zerado nos dados, informe que aparece R$ 0,00 nos dados recebidos e não tente explicar ou inventar motivos.
- Se um campo não existir nos dados, diga que a informação não está disponível.
- Cite os valores exatos, nomes e datas que aparecem nos dados abaixo.

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

        // Atualiza cookies se houve refresh
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
