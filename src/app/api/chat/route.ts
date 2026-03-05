import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Força renderização dinâmica (necessário para cookies() funcionar)
export const dynamic = 'force-dynamic';

const CONTA_AZUL_API = 'https://api.contaazul.com/v1';

// Busca dados reais do Conta Azul usando o token Bearer autenticado
async function fetchContaAzulData(token: string): Promise<string> {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    // Datas para filtrar os últimos 30 dias
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    const results: Record<string, unknown> = {};

    // Busca vendas dos últimos 30 dias
    try {
        const salesRes = await fetch(
            `${CONTA_AZUL_API}/sales?status=COMMITTED&emission_start=${dateFrom}&emission_end=${dateTo}&page=0&size=100`,
            { headers }
        );
        if (salesRes.ok) {
            results.vendas = await salesRes.json();
        } else {
            results.vendasErro = `Status ${salesRes.status}`;
        }
    } catch (e) {
        results.vendasErro = String(e);
    }

    // Busca contas a receber (recebíveis em aberto)
    try {
        const arRes = await fetch(
            `${CONTA_AZUL_API}/receivables?status=PENDING&page=0&size=50`,
            { headers }
        );
        if (arRes.ok) {
            results.contasReceber = await arRes.json();
        } else {
            results.contasReceberErro = `Status ${arRes.status}`;
        }
    } catch (e) {
        results.contasReceberErro = String(e);
    }

    // Busca contas a pagar (pagáveis em aberto)
    try {
        const apRes = await fetch(
            `${CONTA_AZUL_API}/payables?status=PENDING&page=0&size=50`,
            { headers }
        );
        if (apRes.ok) {
            results.contasPagar = await apRes.json();
        } else {
            results.contasPagarErro = `Status ${apRes.status}`;
        }
    } catch (e) {
        results.contasPagarErro = String(e);
    }

    // Busca contas financeiras (saldo)
    try {
        const acRes = await fetch(
            `${CONTA_AZUL_API}/financial-accounts?page=0&size=20`,
            { headers }
        );
        if (acRes.ok) {
            results.contasFinanceiras = await acRes.json();
        } else {
            results.contasFinanceirasErro = `Status ${acRes.status}`;
        }
    } catch (e) {
        results.contasFinanceirasErro = String(e);
    }

    // Formata um resumo legível a partir dos dados brutos
    let context = `DADOS REAIS DO CONTA AZUL (Última atualização: ${today.toLocaleString('pt-BR')}):\n\n`;

    // Processa vendas
    if (results.vendas && typeof results.vendas === 'object') {
        const vendas = results.vendas as { data?: { value?: number }[]; total_elements?: number };
        const items = Array.isArray(vendas.data) ? vendas.data : (Array.isArray(vendas) ? vendas as unknown[] : []);
        const totalVendas = (items as { value?: number }[]).reduce((sum, v) => sum + (v.value || 0), 0);
        context += `📊 VENDAS (últimos 30 dias): ${items.length || vendas.total_elements || 0} transações | Total: R$ ${totalVendas.toFixed(2)}\n`;
        // Inclui as primeiras 5 vendas para a IA ter detalhes
        const topVendas = (items as { value?: number; status?: string; emission_date?: string; number?: number }[]).slice(0, 5);
        if (topVendas.length > 0) {
            context += `Últimas vendas:\n${topVendas.map(v => `  - Venda #${v.number || '?'}: R$ ${(v.value || 0).toFixed(2)} em ${v.emission_date || '?'} (${v.status || '?'})`).join('\n')}\n`;
        }
    } else if (results.vendasErro) {
        context += `📊 VENDAS: Erro ao buscar - ${results.vendasErro}\n`;
    }

    // Processa contas a receber
    if (results.contasReceber && typeof results.contasReceber === 'object') {
        const receber = results.contasReceber as { data?: { value?: number; due_date?: string; name?: string }[]; total_elements?: number };
        const items: { value?: number; due_date?: string; name?: string }[] = Array.isArray(receber.data) ? receber.data : (Array.isArray(receber) ? receber as unknown as { value?: number; due_date?: string; name?: string }[] : []);
        const totalReceber = items.reduce((sum, v) => sum + (v.value || 0), 0);
        context += `\n💰 CONTAS A RECEBER: ${items.length || receber.total_elements || 0} pendentes | Total: R$ ${totalReceber.toFixed(2)}\n`;
        const top5 = items.slice(0, 5);
        if (top5.length > 0) {
            context += `Próximos recebimentos:\n${top5.map(v => `  - ${v.name || 'Cliente'}: R$ ${(v.value || 0).toFixed(2)} - Vence: ${v.due_date || '?'}`).join('\n')}\n`;
        }
    } else if (results.contasReceberErro) {
        context += `\n💰 CONTAS A RECEBER: Erro ao buscar - ${results.contasReceberErro}\n`;
    }

    // Processa contas a pagar
    if (results.contasPagar && typeof results.contasPagar === 'object') {
        const pagar = results.contasPagar as { data?: { value?: number; due_date?: string; name?: string }[]; total_elements?: number };
        const items: { value?: number; due_date?: string; name?: string }[] = Array.isArray(pagar.data) ? pagar.data : (Array.isArray(pagar) ? pagar as unknown as { value?: number; due_date?: string; name?: string }[] : []);
        const totalPagar = items.reduce((sum, v) => sum + (v.value || 0), 0);
        context += `\n📉 CONTAS A PAGAR: ${items.length || pagar.total_elements || 0} pendentes | Total: R$ ${totalPagar.toFixed(2)}\n`;
        const top5 = items.slice(0, 5);
        if (top5.length > 0) {
            context += `Próximos pagamentos:\n${top5.map(v => `  - ${v.name || 'Fornecedor'}: R$ ${(v.value || 0).toFixed(2)} - Vence: ${v.due_date || '?'}`).join('\n')}\n`;
        }
    } else if (results.contasPagarErro) {
        context += `\n📉 CONTAS A PAGAR: Erro ao buscar - ${results.contasPagarErro}\n`;
    }

    // Processa contas financeiras
    if (results.contasFinanceiras && typeof results.contasFinanceiras === 'object') {
        const contas = results.contasFinanceiras as { data?: { name?: string; balance?: number; bank_account?: { bank_name?: string } }[] };
        const items = Array.isArray(contas.data) ? contas.data : (Array.isArray(contas) ? contas as unknown as { name?: string; balance?: number }[] : []);
        const saldoTotal = (items as { balance?: number }[]).reduce((sum, c) => sum + (c.balance || 0), 0);
        context += `\n🏦 CONTAS FINANCEIRAS: ${items.length} contas | Saldo Total: R$ ${saldoTotal.toFixed(2)}\n`;
        (items as { name?: string; balance?: number; bank_account?: { bank_name?: string } }[]).forEach(c => {
            context += `  - ${c.name || 'Conta'} (${c.bank_account?.bank_name || 'Banco'}): R$ ${(c.balance || 0).toFixed(2)}\n`;
        });
    } else if (results.contasFinanceirasErro) {
        context += `\n🏦 CONTAS FINANCEIRAS: Erro ao buscar - ${results.contasFinanceirasErro}\n`;
    }

    context += `\nDADOS BRUTOS JSON (para referência detalhada da IA):\n${JSON.stringify(results, null, 2).substring(0, 3000)}`;

    return context;
}

export async function POST(req: NextRequest) {
    // Importação dinâmica do OpenAI para evitar problemas no build estático do Next.js
    const OpenAI = (await import('openai')).default;

    const openai = new OpenAI({
        apiKey: process.env.THESYS_API_KEY || 'missing-key',
        baseURL: 'https://api.thesys.dev/v1/embed',
    });

    try {
        const { messages } = await req.json();

        // Obter token do Conta Azul nos cookies
        const cookieStore = cookies();
        const token = cookieStore.get('contaazul_access_token')?.value;

        let financialContext: string;

        if (token) {
            // Busca dados REAIS do Conta Azul
            console.log('Buscando dados reais do Conta Azul...');
            financialContext = await fetchContaAzulData(token);
            console.log('Dados do Conta Azul obtidos com sucesso');
        } else {
            financialContext = 'O usuário ainda não conectou o Conta Azul ou o token expirou. Solicite que o usuário faça login no Conta Azul.';
        }

        const systemPrompt = `Você é um assistente financeiro premium integrado ao Conta Azul. Responda em português do Brasil de forma amigável e profissional.
Você tem acesso aos dados financeiros REAIS e ATUALIZADOS da conta do usuário no Conta Azul.
Use esses dados para responder com precisão. Utilize componentes visuais (gráficos, tabelas, cards) sempre que fizer sentido.

${financialContext}`;

        // Modelo TheSys confirmado via GET /v1/embed/models
        const stream = await openai.chat.completions.create({
            model: 'c1/anthropic/claude-sonnet-4/v-20251230',
            stream: true,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
        });

        // ReadableStream que manda os deltas de texto brutos
        const readableStream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of stream) {
                        const text = chunk.choices[0]?.delta?.content || '';
                        if (text) {
                            controller.enqueue(encoder.encode(text));
                        }
                    }
                } catch (e) {
                    console.error('Stream error:', e);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
            },
        });

    } catch (error) {
        console.error('TheSys Chat API Error:', error);
        const msg = error instanceof Error ? error.message : 'Erro ao comunicar com a IA.';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
