'use client';

import { useState } from 'react';
import { C1Component } from '@thesysai/genui-sdk';
import { ThemeProvider } from '@crayonai/react-ui';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userVal = input.trim();
        setInput('');

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userVal };
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        const aiMsgId = (Date.now() + 1).toString();
        setMessages((prev) => [...prev, { id: aiMsgId, role: 'assistant', content: '' }]);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [...messages, userMsg] }),
            });

            if (!res.ok) throw new Error("Erro na API");

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // API agora envia texto bruto direto
                    const text = decoder.decode(value, { stream: true });

                    setMessages((prev) =>
                        prev.map(msg =>
                            msg.id === aiMsgId ? { ...msg, content: msg.content + text } : msg
                        )
                    );
                }
            }
        } catch (error) {
            console.error(error);
            setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Desculpe, ocorreu um erro ao se conectar com a IA.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ThemeProvider>
            <div style={styles.container} className="glass-panel">

                {/* Header */}
                <div style={styles.header}>
                    <h2>IA Financeira - Conta Azul</h2>
                    <p>Seus dados financeiros vivos em tempo real.</p>
                </div>

                {/* Message Area */}
                <div style={styles.messagesContainer}>
                    {messages.length === 0 ? (
                        <div style={styles.emptyState}>
                            Boas-vindas! Pergunte sobre seu faturamento, saldo, ou contas a pagar...
                        </div>
                    ) : (
                        messages.map((m) => (
                            <div key={m.id} style={{
                                ...styles.messageWrapper,
                                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
                            }}>
                                <div style={{
                                    ...styles.bubble,
                                    backgroundColor: m.role === 'user' ? '#1D4ED8' : 'rgba(255, 255, 255, 0.05)',
                                    color: m.role === 'user' ? 'white' : '#E2E8F0',
                                    maxWidth: m.role === 'user' ? '70%' : '100%'
                                }}>
                                    {/* TheSys GenUI C1Component magic happens here! */}
                                    <C1Component c1Response={m.content} isStreaming={isLoading && m.role === 'assistant'} />
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div style={{ ...styles.messageWrapper, justifyContent: 'flex-start' }}>
                            <div style={{ ...styles.bubble, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                                <span className="typing-indicator">Analisando dados do Conta Azul...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <form onSubmit={handleSubmit} style={styles.form}>
                    <input
                        style={styles.input}
                        value={input}
                        placeholder="Qual o meu faturamento de hoje?"
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
                    />
                    <button style={styles.sendButton} type="submit" disabled={isLoading || !input.trim()}>
                        {isLoading ? '...' : 'Enviar'}
                    </button>
                </form>

            </div>
        </ThemeProvider>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        height: '100%',
        maxHeight: 'calc(100vh - 40px)',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, rgba(13, 17, 23, 0.7) 0%, rgba(13, 17, 23, 0.9) 100%)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    },
    header: {
        padding: '24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'white',
    },
    messagesContainer: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '24px',
    },
    emptyState: {
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94A3B8',
        fontSize: '1.2rem',
        textAlign: 'center' as const,
    },
    messageWrapper: {
        display: 'flex',
        width: '100%',
    },
    bubble: {
        padding: '16px 20px',
        borderRadius: '16px',
        fontSize: '15px',
        lineHeight: '1.6',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    },
    form: {
        display: 'flex',
        padding: '24px',
        gap: '12px',
        background: 'rgba(0,0,0,0.2)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    },
    input: {
        flex: 1,
        padding: '16px 24px',
        borderRadius: '99px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        fontSize: '16px',
        outline: 'none',
        transition: 'all 0.2s',
    },
    sendButton: {
        padding: '16px 32px',
        borderRadius: '99px',
        background: '#1D4ED8',
        color: 'white',
        border: 'none',
        fontSize: '16px',
        fontWeight: '600' as const,
        cursor: 'pointer',
        transition: 'background 0.2s',
    }
};
