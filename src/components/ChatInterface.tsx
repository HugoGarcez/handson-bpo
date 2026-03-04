'use client';

import { useState, useRef, useEffect } from 'react';

type MessageData = {
    type: 'chart' | 'table';
    title: string;
    metrics?: { total: string; period: string };
    items?: Array<{ client: string; value: string; due: string }>;
};

type Message = {
    id: string;
    role: 'user' | 'ai';
    content: string;
    data?: MessageData;
};

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'ai',
            content: 'Olá! Sou seu assistente financeiro integrado ao Conta Azul. Como posso ajudar com seus dados hoje?',
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        // Mock response simulating a Server Action / Backend API call
        setTimeout(() => {
            const response: Message = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: 'Aqui está um resumo simulado com base no seu pedido, utilizando um componente visual do tipo Generative UI.'
            };

            if (userMsg.content.toLowerCase().includes('vendas')) {
                response.data = {
                    type: 'chart',
                    title: 'Vendas Recentes (Mock)',
                    metrics: { total: 'R$ 45.230,00', period: 'Últimos 30 dias' }
                };
            } else if (userMsg.content.toLowerCase().includes('receber')) {
                response.data = {
                    type: 'table',
                    title: 'Contas a Receber (Mock)',
                    items: [
                        { client: 'Empresa A', value: 'R$ 1.500,00', due: 'Hoje' },
                        { client: 'Empresa B', value: 'R$ 3.200,00', due: 'Amanhã' },
                    ]
                };
            }

            setMessages(prev => [...prev, response]);
            setIsLoading(false);
        }, 1500);
    };

    return (
        <div style={styles.container} className="glass-panel">
            <div style={styles.messageList}>
                {messages.map((msg) => (
                    <div key={msg.id} style={{
                        ...styles.messageWrapper,
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                    }}>
                        <div style={{
                            ...styles.bubble,
                            ...(msg.role === 'user' ? styles.userBubble : styles.aiBubble)
                        }}>
                            <p>{msg.content}</p>

                            {/* Generative UI Components Simulation */}
                            {msg.data && msg.data.type === 'chart' && (
                                <div style={styles.widgetCard}>
                                    <h4 style={styles.widgetTitle}>{msg.data.title}</h4>
                                    <div style={styles.metricBig}>{msg.data.metrics?.total}</div>
                                    <div style={styles.metricSmall}>{msg.data.metrics?.period}</div>
                                    <div style={styles.mockChart}>
                                        <div style={{ ...styles.bar, height: '40%' }}></div>
                                        <div style={{ ...styles.bar, height: '70%' }}></div>
                                        <div style={{ ...styles.bar, height: '50%' }}></div>
                                        <div style={{ ...styles.bar, height: '90%' }}></div>
                                        <div style={{ ...styles.bar, height: '60%' }}></div>
                                    </div>
                                </div>
                            )}

                            {msg.data && msg.data.type === 'table' && (
                                <div style={styles.widgetCard}>
                                    <h4 style={styles.widgetTitle}>{msg.data.title}</h4>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr>
                                                <th style={styles.th}>Cliente</th>
                                                <th style={styles.th}>Valor</th>
                                                <th style={styles.th}>Vencimento</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {msg.data.items?.map((item, i: number) => (
                                                <tr key={i}>
                                                    <td style={styles.td}>{item.client}</td>
                                                    <td style={styles.td}>{item.value}</td>
                                                    <td style={styles.td}>{item.due}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div style={{ ...styles.messageWrapper, justifyContent: 'flex-start' }}>
                        <div style={{ ...styles.bubble, ...styles.aiBubble }}>
                            <span className="loading-dots">Gerando insights...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} style={styles.inputArea}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pergunte sobre suas finanças (ex: 'mostrar vendas' ou 'contas a receber')..."
                    style={styles.input}
                    disabled={isLoading}
                />
                <button type="submit" style={styles.sendBtn} disabled={isLoading || !input.trim()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </form>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        height: '100%',
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'hidden',
    },
    messageList: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.5rem',
    },
    messageWrapper: {
        display: 'flex',
        width: '100%',
    },
    bubble: {
        maxWidth: '80%',
        padding: '1rem 1.5rem',
        borderRadius: '16px',
        lineHeight: 1.5,
        fontSize: '0.95rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    },
    userBubble: {
        background: 'linear-gradient(135deg, #2F80ED 0%, #1b62bf 100%)',
        color: '#fff',
        borderBottomRightRadius: '4px',
    },
    aiBubble: {
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-color)',
        borderBottomLeftRadius: '4px',
    },
    inputArea: {
        display: 'flex',
        padding: '1.5rem',
        borderTop: '1px solid var(--border-color)',
        background: 'rgba(22, 27, 34, 0.4)',
        gap: '1rem',
    },
    input: {
        flex: 1,
        padding: '1rem 1.5rem',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        background: 'rgba(13, 17, 23, 0.8)',
        color: 'var(--text-color)',
        fontSize: '1rem',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    sendBtn: {
        background: 'var(--primary-color)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        width: '3.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.2s',
    },
    widgetCard: {
        marginTop: '1rem',
        padding: '1.5rem',
        background: 'rgba(13, 17, 23, 0.5)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
    },
    widgetTitle: {
        fontSize: '1rem',
        fontWeight: 600,
        marginBottom: '1rem',
        color: '#fff',
    },
    metricBig: {
        fontSize: '2rem',
        fontWeight: 800,
        color: '#56CCF2',
    },
    metricSmall: {
        fontSize: '0.85rem',
        color: '#8b949e',
        marginBottom: '1rem',
    },
    mockChart: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: '100px',
        marginTop: '1.5rem',
        padding: '1rem 0 0 0',
        borderBottom: '1px solid var(--border-color)',
    },
    bar: {
        width: '15%',
        background: 'linear-gradient(180deg, #56CCF2 0%, #2F80ED 100%)',
        borderRadius: '4px 4px 0 0',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
    },
    th: {
        textAlign: 'left' as const,
        padding: '0.75rem 0.5rem',
        color: '#8b949e',
        fontSize: '0.85rem',
        borderBottom: '1px solid var(--border-color)',
    },
    td: {
        padding: '0.75rem 0.5rem',
        fontSize: '0.9rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    }
};
