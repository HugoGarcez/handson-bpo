import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshContaAzulToken, TokenData } from '@/lib/token-utils';

export const dynamic = 'force-dynamic';

const CA_API = 'https://api-v2.contaazul.com';

// ═══════════════════════════════════════════════════════════════
//  CAMPO CONFIRMADOS VIA DEBUG (não alterar sem verificar API)
//  Vendas:  item.total | item.situacao.nome | data.total_itens
//  Contas:  item.valor | item.situacao.nome | item.data_vencimento
//  Saldo:   /v1/conta-financeira/{id} retorna saldo_atual
// ═══════════════════════════════════════════════════════════════

interface SituacaoObj { nome?: string; descricao?: string; }
interface VendaItem {
    numero?: number;
    total?: number;           // campo confirmado
    data?: string;
    cliente?: { nome?: string };
    situacao?: SituacaoObj;   // status confirmado
}
interface EventoItem {
    descricao?: string;
    valor?: number;
    valor_pendente?: number;
    data_vencimento?: string;
    situacao?: SituacaoObj | string;
    status?: string;
}
interface ContaFinanceira {
    id?: string;
    nome?: string;
    banco?: string;
    tipo?: string;
    ativo?: boolean;
    saldo_atual?: number;
}

async function fetchContaAzulData(token: string): Promise<{ context: string; newToken?: TokenData }> {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const d30ago = new Date(today); d30ago.setDate(today.getDate() - 30);
    const d90ago = new Date(today); d90ago.setDate(today.getDate() - 90);
    const d90fwd = new Date(today); d90fwd.setDate(today.getDate() + 90);

    let currentToken = token;
    let refreshedTokenData: TokenData | undefined;

    // GET com refresh automático em 401
    const req = async (url: string): Promise<Response> => {
        const hdrs = { 'Authorization': `Bearer ${currentToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };
        let r = await fetch(url, { headers: hdrs });
        if (r.status === 401 && !refreshedTokenData) {
            const rr = await refreshContaAzulToken();
            if (rr.success && rr.data) {
                refreshedTokenData = rr.data;
                currentToken = rr.data.accessToken;
                r = await fetch(url, { headers: { ...hdrs, 'Authorization': `Bearer ${currentToken}` } });
            }
        }
        return r;
    };

    // POST com JSON body + refresh automático em 401
    const reqPost = async (url: string, body: Record<string, unknown>): Promise<Response> => {
        const hdrs = { 'Authorization': `Bearer ${currentToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };
        let r = await fetch(url, { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
        if (r.status === 401 && !refreshedTokenData) {
            const rr = await refreshContaAzulToken();
            if (rr.success && rr.data) {
                refreshedTokenData = rr.data;
                currentToken = rr.data.accessToken;
                r = await fetch(url, { method: 'POST', headers: { ...hdrs, 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify(body) });
            }
        }
        return r;
    };

    // Lógica de paginação compartilhada
    const processPaginatedResponse = async <T>(
        fetchFn: (page: number, pageSize: number) => Promise<Response>,
        pageSize = 200
    ): Promise<{ itens: T[]; totais: Record<string, unknown>; totalItens: number }> => {
        let page = 0;
        const all: T[] = [];
        let rootTotais: Record<string, unknown> = {};
        let totalItens = 0;

        while (true) {
            const r = await fetchFn(page, pageSize);

            if (!r.ok) {
                const err = await r.text();
                if (page === 0) throw new Error(`HTTP ${r.status}: ${err.substring(0, 300)}`);
                console.warn(`[CA] p${page} erro ${r.status}, parando.`);
                break;
            }

            const data: Record<string, unknown> = await r.json();

            if (page === 0) {
                if (data.totais && typeof data.totais === 'object') rootTotais = data.totais as Record<string, unknown>;
                totalItens = (data.total_itens as number) || (data.itens_totais as number) || 0;
            }

            const itens = Array.isArray(data.itens) ? (data.itens as T[]) : [];
            all.push(...itens);
            console.log(`[CA] p${page} (${r.url?.split('?')[0].split('/').pop()}): ${itens.length} itens | total: ${all.length}`);

            if (itens.length === 0 || itens.length < pageSize) break;
            if (page >= 19) { console.warn('[CA] Limite 20 páginas.'); break; }
            page++;
        }

        if (totalItens === 0) totalItens = all.length;
        return { itens: all, totais: rootTotais, totalItens };
    };

    // Paginação via GET (ex: vendas)
    const fetchPages = <T>(buildUrl: (p: number, s: number) => string, pageSize = 200) =>
        processPaginatedResponse<T>(
            (p, s) => { console.log(`[CA] GET p${p}: ${buildUrl(p, s)}`); return req(buildUrl(p, s)); },
            pageSize
        );

    // Paginação via POST com JSON body (ex: contas a receber/pagar — endpoints /buscar)
    const fetchPostPages = <T>(url: string, buildBody: (p: number, s: number) => Record<string, unknown>, pageSize = 200) =>
        processPaginatedResponse<T>(
            (p, s) => { const body = buildBody(p, s); console.log(`[CA] POST p${p}: ${url}`, body); return reqPost(url, body); },
            pageSize
        );

    const n = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);
    const s = (v: unknown): string => (typeof v === 'string' ? v : '');
    const brl = (v: unknown) => `R$ ${n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Extrai nome de situacao (pode ser string ou objeto {nome, descricao})
    const getSituacao = (item: Record<string, unknown>): string => {
        const sit = item.situacao;
        if (sit && typeof sit === 'object') return s((sit as SituacaoObj).descricao || (sit as SituacaoObj).nome);
        if (typeof sit === 'string') return sit;
        return s(item.status);
    };

    // ── 1. VENDAS (30 dias) ───────────────────────────────────────────────────
    let vendasItens: VendaItem[] = [];
    let vendasTotais: Record<string, unknown> = {};
    let vendasTotal = 0;
    let vendasErro = '';
    try {
        const v = await fetchPages<VendaItem>(
            (p, s) => `${CA_API}/v1/venda/busca?dataEmissaoInicio=${fmt(d30ago)}&dataEmissaoFim=${fmt(today)}&pagina=${p}&tamanhoPagina=${s}`
        );
        vendasItens = v.itens;
        vendasTotais = v.totais;
        vendasTotal = v.totalItens;
    } catch (e) { vendasErro = String(e); }

    // ── 2. CONTAS A RECEBER — POST com JSON body (endpoint /buscar exige POST) ─
    let receberItens: EventoItem[] = [];
    let receberTotais: Record<string, unknown> = {};
    let receberTotal = 0;
    let receberErro = '';
    try {
        const r = await fetchPostPages<EventoItem>(
            `${CA_API}/v1/financeiro/eventos-financeiros/contas-a-receber/buscar`,
            (p, sz) => ({
                data_vencimento_de: fmt(d90ago),
                data_vencimento_ate: fmt(d90fwd),
                pagina: p,
                tamanhoPagina: sz,
            })
        );
        receberItens = r.itens;
        receberTotais = r.totais;
        receberTotal = r.totalItens;
    } catch (e) { receberErro = String(e); }

    // ── 3. CONTAS A PAGAR — POST com JSON body (endpoint /buscar exige POST) ───
    let pagarItens: EventoItem[] = [];
    let pagarTotais: Record<string, unknown> = {};
    let pagarTotal = 0;
    let pagarErro = '';
    try {
        const p = await fetchPostPages<EventoItem>(
            `${CA_API}/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar`,
            (pg, sz) => ({
                data_vencimento_de: fmt(d90ago),
                data_vencimento_ate: fmt(d90fwd),
                pagina: pg,
                tamanhoPagina: sz,
            })
        );
        pagarItens = p.itens;
        pagarTotais = p.totais;
        pagarTotal = p.totalItens;
    } catch (e) { pagarErro = String(e); }

    // ── 4. CONTAS FINANCEIRAS + SALDO INDIVIDUAL ──────────────────────────────
    // O endpoint de lista não retorna saldo_atual; é preciso buscar cada conta individualmente
    let contas: ContaFinanceira[] = [];
    let contasErro = '';
    try {
        const r = await req(`${CA_API}/v1/conta-financeira`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: { itens?: ContaFinanceira[] } = await r.json();
        const ativas = (data.itens ?? []).filter(c => c.ativo !== false);

        // Busca saldo de cada conta em paralelo via endpoint individual
        contas = await Promise.all(
            ativas.map(async (conta) => {
                if (!conta.id) return conta;
                try {
                    const dr = await req(`${CA_API}/v1/conta-financeira/${conta.id}`);
                    if (dr.ok) {
                        const detail: ContaFinanceira = await dr.json();
                        return { ...conta, saldo_atual: detail.saldo_atual ?? 0 };
                    }
                } catch { /* ignora */ }
                return { ...conta, saldo_atual: 0 };
            })
        );
    } catch (e) { contasErro = String(e); }

    // ── MONTA CONTEXTO PARA A IA ──────────────────────────────────────────────
    let ctx = `DADOS REAIS DO CONTA AZUL ERP (${today.toLocaleString('pt-BR')}):\n\n`;

    // Vendas
    if (vendasErro) {
        ctx += `📊 VENDAS: ERRO — ${vendasErro}\n`;
    } else {
        // totais vêm da raiz da resposta (calculado pela Conta Azul para o período inteiro)
        const tFat = n(vendasTotais.total);
        const tAprov = n(vendasTotais.aprovado);
        const tCanc = n(vendasTotais.cancelado);
        const tPend = n(vendasTotais.esperando_aprovacao);
        const qtd = vendasTotal;
        const qtdAprov = n((vendasTotais.quantidades as Record<string, unknown>)?.aprovado);
        const qtdPend = n((vendasTotais.quantidades as Record<string, unknown>)?.esperando_aprovacao);

        ctx += `📊 VENDAS (últimos 30 dias):\n`;
        ctx += `  Total: ${qtd} vendas | Faturado: ${brl(tFat)}\n`;
        ctx += `  Aprovadas: ${qtdAprov} | ${brl(tAprov)}\n`;
        if (tPend > 0) ctx += `  Aguardando aprovação: ${qtdPend} | ${brl(tPend)}\n`;
        if (tCanc > 0) ctx += `  Canceladas: ${brl(tCanc)}\n`;

        if (vendasItens.length > 0) {
            ctx += `  Detalhes das vendas:\n`;
            vendasItens.forEach(item => {
                const valor = n(item.total);  // campo confirmado = "total"
                const sit = item.situacao ? s(item.situacao.descricao || item.situacao.nome) : '';
                ctx += `    • #${item.numero ?? '?'} | ${item.cliente?.nome ?? '-'} | ${brl(valor)} | ${sit} | ${item.data ?? ''}\n`;
            });
        }
        ctx += '\n';
    }

    // Contas a Receber
    if (receberErro) {
        ctx += `💰 CONTAS A RECEBER: ERRO — ${receberErro}\n`;
    } else {
        // Usa totais da raiz quando disponíveis; senão calcula dos itens
        const tTotal = n(receberTotais.total) || receberItens.reduce((s, i) => s + n(i.valor), 0);
        const tPend = n(receberTotais.pendente) || receberItens.filter(i => getSituacao(i as Record<string, unknown>) !== 'Pago').reduce((s, i) => s + (n(i.valor_pendente) || n(i.valor)), 0);
        const tPago = n(receberTotais.pago);
        const vencidos = receberItens.filter(i => i.data_vencimento && i.data_vencimento < fmt(today) && getSituacao(i as Record<string, unknown>).toLowerCase() !== 'pago');

        ctx += `💰 CONTAS A RECEBER (90 dias):\n`;
        ctx += `  Total de títulos: ${receberTotal}\n`;
        ctx += `  Valor total do período: ${brl(tTotal)}\n`;
        ctx += `  Pendente (a receber): ${brl(tPend)}\n`;
        if (tPago > 0) ctx += `  Já recebido: ${brl(tPago)}\n`;
        ctx += `  Vencidos e não pagos: ${vencidos.length} títulos\n`;

        if (receberItens.length > 0) {
            ctx += `  Títulos:\n`;
            receberItens.forEach(i => {
                const valor = n(i.valor_pendente) || n(i.valor);
                const sit = getSituacao(i as Record<string, unknown>);
                ctx += `    • ${i.descricao ?? 'Recebível'} | ${brl(valor)} | Vence: ${i.data_vencimento ?? '?'} | ${sit}\n`;
            });
        }
        ctx += '\n';
    }

    // Contas a Pagar
    if (pagarErro) {
        ctx += `📉 CONTAS A PAGAR: ERRO — ${pagarErro}\n`;
    } else {
        const tTotal = n(pagarTotais.total) || pagarItens.reduce((s, i) => s + n(i.valor), 0);
        const tPend = n(pagarTotais.pendente) || pagarItens.filter(i => getSituacao(i as Record<string, unknown>) !== 'Pago').reduce((s, i) => s + (n(i.valor_pendente) || n(i.valor)), 0);
        const tPago = n(pagarTotais.pago);
        const vencidos = pagarItens.filter(i => i.data_vencimento && i.data_vencimento < fmt(today) && getSituacao(i as Record<string, unknown>).toLowerCase() !== 'pago');

        ctx += `📉 CONTAS A PAGAR (90 dias):\n`;
        ctx += `  Total de títulos: ${pagarTotal}\n`;
        ctx += `  Valor total do período: ${brl(tTotal)}\n`;
        ctx += `  Pendente (a pagar): ${brl(tPend)}\n`;
        if (tPago > 0) ctx += `  Já pago: ${brl(tPago)}\n`;
        ctx += `  Vencidos e não pagos: ${vencidos.length} títulos\n`;

        if (pagarItens.length > 0) {
            ctx += `  Títulos:\n`;
            pagarItens.forEach(i => {
                const valor = n(i.valor_pendente) || n(i.valor);
                const sit = getSituacao(i as Record<string, unknown>);
                ctx += `    • ${i.descricao ?? 'Pagável'} | ${brl(valor)} | Vence: ${i.data_vencimento ?? '?'} | ${sit}\n`;
            });
        }
        ctx += '\n';
    }

    // Saldo
    if (contasErro) {
        ctx += `🏦 SALDO: ERRO — ${contasErro}\n`;
    } else {
        const saldoTotal = contas.reduce((s, c) => s + n(c.saldo_atual), 0);
        ctx += `🏦 SALDO (contas ativas):\n`;
        ctx += `  Total consolidado: ${brl(saldoTotal)}\n`;
        contas.forEach(c => {
            ctx += `  • ${c.nome ?? c.banco} (${c.tipo ?? ''}): ${brl(c.saldo_atual)}\n`;
        });
        ctx += '\n';
    }

    console.log('[CA] Contexto final:\n' + ctx);
    return { context: ctx, newToken: refreshedTokenData };
}

// ════════════════════════════════════════════════════════════════
//  POST — Chat com streaming
// ════════════════════════════════════════════════════════════════
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

        let financialContext = 'O usuário não autenticou o Conta Azul. Peça para visitar /api/auth/contaazul.';
        let refreshedData: TokenData | undefined;

        if (token) {
            const r = await fetchContaAzulData(token);
            financialContext = r.context;
            refreshedData = r.newToken;
        } else {
            console.log('[Chat] Sem access_token, tentando refresh...');
            const rr = await refreshContaAzulToken();
            if (rr.success && rr.data) {
                refreshedData = rr.data;
                const r = await fetchContaAzulData(rr.data.accessToken);
                financialContext = r.context;
                if (r.newToken) refreshedData = r.newToken;
            }
        }

        const systemPrompt = `Você é um especialista financeiro e contábil integrado ao Conta Azul ERP. Responda SEMPRE em português do Brasil.

REGRAS ABSOLUTAS:
1. USE APENAS os dados abaixo. JAMAIS invente, estime ou suponha valores não listados.
2. Se um valor aparecer como R$ 0,00 nos dados, diga exatamente isso — não tente explicar ou inventar causas.
3. Cite valores exatos com centavos (ex: R$ 8.940.728,02), nomes de clientes, datas e situações tal como aparecem.
4. Se perguntado sobre algo fora dos dados abaixo, diga claramente que a informação não está disponível nos dados recebidos.
5. Ao sumarizar: some corretamente, não arredonde sem avisar, compare períodos apenas se ambos estiverem nos dados.

════ DADOS REAIS DO CONTA AZUL ════
${financialContext}
════════════════════════════════════`;

        const chatStream = await openai.chat.completions.create({
            model: 'c1/anthropic/claude-sonnet-4/v-20251230',
            stream: true,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
        });

        const stream = new ReadableStream({
            async start(controller) {
                const enc = new TextEncoder();
                try {
                    for await (const chunk of chatStream) {
                        const txt = chunk.choices[0]?.delta?.content || '';
                        if (txt) controller.enqueue(enc.encode(txt));
                    }
                } catch (e) {
                    console.error('Stream error:', e);
                } finally {
                    controller.close();
                }
            },
        });

        const response = new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
            },
        });

        if (refreshedData) {
            response.headers.append('Set-Cookie', `contaazul_access_token=${refreshedData.accessToken}; HttpOnly; Secure; Path=/; Max-Age=${refreshedData.expiresIn}`);
            if (refreshedData.refreshToken) {
                response.headers.append('Set-Cookie', `contaazul_refresh_token=${refreshedData.refreshToken}; HttpOnly; Secure; Path=/; Max-Age=${30 * 24 * 60 * 60}`);
            }
        }

        return response;

    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: 'Erro na comunicação com a IA.' }, { status: 500 });
    }
}
