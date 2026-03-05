import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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

        // Test what kind of chunks it yields
        for await (const chunk of result.textStream) {
            process.stdout.write(chunk);
        }
    } catch (e) {
        console.error("Caught error:", e);
    }
}

main();
