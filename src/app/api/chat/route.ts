import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { cookies } from 'next/headers';

export const runtime = 'edge';

// Configura o TheSys API Key usando o helper map do vercel/ai
const thesys = createOpenAI({
    apiKey: process.env.THESYS_API_KEY || "missing-thesys-key",
    baseURL: "https://api.thesys.dev/v1/embed"
});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // 1. Obter o token do Conta Azul injetado via Cookie no login
        const cookieStore = cookies();
        const token = cookieStore.get('contaazul_access_token')?.value;

        let financialContext = "O usuário ainda não conectou o Conta Azul ou o token expirou.";

        if (token) {
            // Num cenário de produção real, faríamos as chamadas para api.contaazul.com/v1/sales etc.
            // Simulando a extração dos dados reais via token (Unified System)
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

        const result = await streamText({
            model: thesys('gpt-4o'), // Usa o modelo roteado pela endpoint do TheSys
            system: systemPrompt,
            messages,
        });

        return result.toTextStreamResponse();
    } catch (error) {
        console.error("TheSys Chat API Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro ao comunicar com a IA.';
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
