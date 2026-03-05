import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export const runtime = 'edge';

// Configura o TheSys API Key usando o helper map do vercel/ai
const thesys = createOpenAI({
    apiKey: process.env.THESYS_API_KEY || "missing-thesys-key",
    baseURL: "https://api.thesys.dev/v1/embed"
});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        const result = await streamText({
            model: thesys('gpt-4o'), // Usa o modelo roteado pela endpoint do TheSys
            system: "Você é um assistente financeiro do Conta Azul. Responda o usuário de forma amigável no TheSys GenUI e utilize o componente thesys apropriado para gráficos sempre que vendas ou contas a pagar/receber forem referenciadas.",
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
