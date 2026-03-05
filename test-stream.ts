import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const thesys = createOpenAI({
    apiKey: process.env.THESYS_API_KEY || "test",
    baseURL: "https://api.thesys.dev/v1/embed"
});

async function main() {
    try {
        const result = await streamText({
            model: thesys('gpt-4o'),
            messages: [{ role: 'user', content: 'hello' }],
        });

        for await (const chunk of result.textStream) {
            process.stdout.write(chunk);
        }
        console.log('\nDone');
    } catch (e) {
        console.error("Caught error:", e);
    }
}

main();
