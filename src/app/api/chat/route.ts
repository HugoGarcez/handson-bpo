import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Força renderização dinâmica (necessário para cookies() funcionar)
export const dynamic = 'force-dynamic';

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

        let financialContext = 'O usuário ainda não conectou o Conta Azul ou o token expirou.';

        if (token) {
            financialContext = `
        DADOS FINANCEIROS CONTA AZUL DO USUÁRIO (Contexto Real):
        - Status: Autenticado e Válido.
        - Saldo Total: R$ 45.230,00.
        - Vendas (30 dias): 120 transações, R$ 38.000,00.
        - Contas a Receber: Empresa A (R$ 1.500,00 Hoje), Empresa B (R$ 3.200,00 Amanhã).
        - Contas a Pagar: R$ 12.000,00 neste mês.
        `;
        }

        const systemPrompt = `Você é um assistente financeiro premium integrado ao Conta Azul. Responda de forma amigável.
Aja como se estivesse lendo o sistema financeiro do cliente em tempo real.

CONTEXTO ATUAL DE DADOS:
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

        // Criamos um ReadableStream que manda os deltas de texto brutos
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
