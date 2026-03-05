import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Força renderização dinâmica (necessário para cookies() funcionar)
export const dynamic = 'force-dynamic';

const CONTA_AZUL_API = 'https://api.contaazul.com';

// Busca dados reais do Conta Azul usando o token Bearer autenticado
async function fetchContaAzulData(token: string): Promise<string> {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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
            `${CONTA_AZUL_API}/v1/sales?status=COMMITTED&emission_start=${dateFrom}&emission_end=${dateTo}&page=0&size=100`,
            { headers }
        );
        const salesBody = await salesRes.text();
        console.log(`[ContaAzul] Sales status: ${salesRes.status}, body: ${salesBody.substring(0, 200)}`);
        if (salesRes.ok) {
            results.vendas = JSON.parse(salesBody);
        } else {
            results.vendasErro = `Status ${salesRes.status}: ${salesBody.substring(0, 100)}`;
        }
    } catch (e) {
        results.vendasErro = String(e);
        console.error('[ContaAzul] Sales error:', e);
    }

    // Busca contas a receber (recebíveis em aberto)
    try {
        const arRes = await fetch(
            `${CONTA_AZUL_API}/v1/receivables?status=PENDING&page=0&size=50`,
            { headers }
        );
        const arBody = await arRes.text();
        console.log(`[ContaAzul] Receivables status: ${arRes.status}, body: ${arBody.substring(0, 200)}`);
        if (arRes.ok) {
            results.contasReceber = JSON.parse(arBody);
        } else {
            results.contasReceberErro = `Status ${arRes.status}: ${arBody.substring(0, 100)}`;
        }
    } catch (e) {
        results.contasReceberErro = String(e);
    }

    // Busca contas a pagar (pagáveis em aberto)
    try {
        const apRes = await fetch(
            `${CONTA_AZUL_API}/v1/payables?status=PENDING&page=0&size=50`,
            { headers }
        );
        const apBody = await apRes.text();
        console.log(`[ContaAzul] Payables status: ${apRes.status}, body: ${apBody.substring(0, 200)}`);
        if (apRes.ok) {
            results.contasPagar = JSON.parse(apBody);
        } else {
            results.contasPagarErro = `Status ${apRes.status}: ${apBody.substring(0, 100)}`;
        }
    } catch (e) {
        results.contasPagarErro = String(e);
    }

    // Busca contas financeiras (saldo)
    try {
        const acRes = await fetch(
            `${CONTA_AZUL_API}/v1/financial-accounts?page=0&size=20`,
            { headers }
        );
        const acBody = await acRes.text();
        console.log(`[ContaAzul] Financial accounts status: ${acRes.status}, body: ${acBody.substring(0, 200)}`);
        if (acRes.ok) {
            results.contasFinanceiras = JSON.parse(acBody);
        } else {
            results.contasFinanceirasErro = `Status ${acRes.status}: ${acBody.substring(0, 100)}`;
        }
    } catch (e) {
        results.contasFinanceirasErro = String(e);
    }

    // Formata um resumo legível a partir dos dados brutos
    let context = `DADOS REAIS DO CONTA AZUL (Última atualização: ${today.toLocaleString('pt-BR')}):\n\n`;

    // Checa se todos deram erro (provavelmente problema de autenticação)
    const erros = [results.vendasErro, results.contasReceberErro, results.contasPagarErro, results.contasFinanceirasErro].filter(Boolean);
    if (erros.length === 4) {
        context += `⚠️ ATENÇÃO: Todas as chamadas à API do Conta Azul falharam.\n`;
        context += `Erros: ${erros.join(' | ')}\n`;
        context += `Token usado (primeiros 20 chars): ${token.substring(0, 20)}...\n`;
    }

    // Processa vendas
    if (results.vendas && typeof results.vendas === 'object') {
        const vendas = results.vendas as { data?: { value?: number }[]; total_elements?: number };
        const items = Array.isArray(vendas) ? vendas as unknown[] : (Array.isArray(vendas?.data) ? vendas.data : []);
        const totalVendas = (items as { value?: number }[]).reduce((sum, v) => sum + (v.value || 0), 0);
        context += `📊 VENDAS (últimos 30 dias): ${items.length || vendas?.total_elements || 0} transações | Total: R$ ${totalVendas.toFixed(2)}\n`;
        const topVendas = (items as { value?: number; status?: string; emission_date?: string; number?: number }[]).slice(0, 5);
        if (topVendas.length > 0) {
            context += `Últimas vendas:\n${topVendas.map(v => `  - Venda #${v.number || '?'}: R$ ${(v.value || 0).toFixed(2)} em ${v.emission_date || '?'} (${v.status || '?'})`).join('\n')}\n`;
        }
    } else if (results.vendasErro) {
        context += `📊 VENDAS: Erro - ${results.vendasErro}\n`;
    }

    // Processa contas a receber
    if (results.contasReceber && typeof results.contasReceber === 'object') {
        const receber = results.contasReceber as { data?: { value?: number; due_date?: string; name?: string }[] };
        const items = Array.isArray(receber) ? receber as unknown[] : (Array.isArray(receber?.data) ? receber.data : []);
        const totalReceber = (items as { value?: number }[]).reduce((sum, v) => sum + (v.value || 0), 0);
        context += `\n💰 CONTAS A RECEBER: ${items.length} pendentes | Total: R$ ${totalReceber.toFixed(2)}\n`;
        (items as { name?: string; value?: number; due_date?: string }[]).slice(0, 5).forEach(v => {
            context += `  - ${v.name || 'Cliente'}: R$ ${(v.value || 0).toFixed(2)} - Vence: ${v.due_date || '?'}\n`;
        });
    } else if (results.contasReceberErro) {
        context += `\n💰 CONTAS A RECEBER: Erro - ${results.contasReceberErro}\n`;
    }

    // Processa contas a pagar
    if (results.contasPagar && typeof results.contasPagar === 'object') {
        const pagar = results.contasPagar as { data?: { value?: number; due_date?: string; name?: string }[] };
        const items = Array.isArray(pagar) ? pagar as unknown[] : (Array.isArray(pagar?.data) ? pagar.data : []);
        const totalPagar = (items as { value?: number }[]).reduce((sum, v) => sum + (v.value || 0), 0);
        context += `\n📉 CONTAS A PAGAR: ${items.length} pendentes | Total: R$ ${totalPagar.toFixed(2)}\n`;
        (items as { name?: string; value?: number; due_date?: string }[]).slice(0, 5).forEach(v => {
            context += `  - ${v.name || 'Fornecedor'}: R$ ${(v.value || 0).toFixed(2)} - Vence: ${v.due_date || '?'}\n`;
        });
    } else if (results.contasPagarErro) {
        context += `\n📉 CONTAS A PAGAR: Erro - ${results.contasPagarErro}\n`;
    }

    // Processa contas financeiras
    if (results.contasFinanceiras && typeof results.contasFinanceiras === 'object') {
        const contas = results.contasFinanceiras as { data?: { name?: string; balance?: number; bank_account?: { bank_name?: string } }[] };
        const items = Array.isArray(contas) ? contas as unknown[] : (Array.isArray(contas?.data) ? contas.data : []);
        const saldoTotal = (items as { balance?: number }[]).reduce((sum, c) => sum + (c.balance || 0), 0);
        context += `\n🏦 SALDO TOTAL: R$ ${saldoTotal.toFixed(2)} (${items.length} contas)\n`;
        (items as { name?: string; balance?: number }[]).forEach(c => {
            context += `  - ${c.name || 'Conta'}: R$ ${(c.balance || 0).toFixed(2)}\n`;
        });
    } else if (results.contasFinanceirasErro) {
        context += `\n🏦 CONTAS FINANCEIRAS: Erro - ${results.contasFinanceirasErro}\n`;
    }

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

        console.log(`[API Chat] Token presente: ${!!token}, cookie keys: ${cookieStore.getAll().map(c => c.name).join(', ')}`);

        let financialContext: string;

        if (token) {
            console.log('[API Chat] Buscando dados reais do Conta Azul...');
            financialContext = await fetchContaAzulData(token);
        } else {
            financialContext = 'O usuário ainda não autenticou o Conta Azul. Solicite que faça login via o botão Conta Azul na página inicial.';
        }

        const systemPrompt = `Você é um assistente financeiro premium integrado ao Conta Azul. Responda em português do Brasil de forma amigável e profissional.
Você tem acesso aos dados financeiros REAIS e ATUALIZADOS da conta do usuário.
Se houver erros nos dados, informe o usuário honestamente.
Use componentes visuais (gráficos, tabelas, cards) sempre que fizer sentido para apresentar os dados.

${financialContext}`;

        const stream = await openai.chat.completions.create({
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
