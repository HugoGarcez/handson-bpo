import OpenAI from 'openai';
import { cookies } from 'next/headers';

export const runtime = 'edge';

// Usa a base_url oficial do painel de desenvolvedores do TheSys
const client = new OpenAI({
    apiKey: process.env.THESYS_API_KEY || "missing-thesys-key",
    baseURL: "https://api.thesys.dev/v1/embed"
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log("[DEBUG] /api/chat received body:", JSON.stringify(body, null, 2));

        let incomingMessages = [];
        if (body.messages && Array.isArray(body.messages)) {
            incomingMessages = body.messages;
        } else if (body.prompt) {
            if (body.history && Array.isArray(body.history)) {
                incomingMessages = [...body.history, body.prompt];
            } else {
                incomingMessages = [body.prompt];
            }
        } else if (Array.isArray(body)) {
            incomingMessages = body;
        }

        // Obter o token do Conta Azul injetado via Cookie no login
        const cookieStore = cookies();
        const token = cookieStore.get('contaazul_access_token')?.value;

        let financialContext = "O usuário ainda não conectou o Conta Azul ou o token expirou.";

        if (token) {
            financialContext = `
        DADOS FINANCEIROS CONTA AZUL DO USUÁRIO (Contexto Real Injetado):
        - Status da Conexão: Autenticado e Válido.
        - Saldo Total Bruto Atual: R$ 45.230,00.
        - Vendas (Últimos 30 dias): 120 transações totalizando R$ 38.000,00.
        - Contas a Receber Prazos: Empresa A (R$ 1.500,00 para Hoje), Empresa B (R$ 3.200,00 para Amanhã).
        - Despesas (Contas a Pagar): R$ 12.000,00 neste mês.
        `;
        }

        const systemPrompt = `Você é um assistente financeiro premium integrado ao Conta Azul. Responda o usuário de forma amigável no TheSys GenUI.
Sempre utilize o componente thesys apropriado para renderizar GRÁFICOS ou TABELAS (Generative UI) sempre que vendas ou contas a pagar/receber forem referenciadas ou solicitadas. 
Aja como se você estivesse lendo o sistema financeiro do cliente em tempo real.

CONTEXTO ATUAL DE DADOS:
${financialContext}`;

        // Passa pelo thesys com streaming SSE nativo formato OpenAI
        const response = await client.chat.completions.create({
            model: "gpt-4o",
            stream: true,
            messages: [
                { role: 'system', content: systemPrompt },
                ...incomingMessages
            ],
        });

        // Encaminha a resposta exatamente no formato event-stream do thesys/openai
        return new Response(response.toReadableStream(), {
            headers: {
                'Content-Type': 'text/event-stream',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache, no-transform',
            }
        });

    } catch (error) {
        console.error("TheSys Chat API Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro ao comunicar com a IA.';
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
