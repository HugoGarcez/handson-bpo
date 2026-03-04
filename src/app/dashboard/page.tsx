'use client';

import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';

export default function Dashboard() {
    const [userName] = useState('Usuário Conta Azul');

    return (
        <div style={styles.container}>
            <header style={styles.header} className="glass-panel">
                <div style={styles.headerContent}>
                    <div style={styles.logo}>
                        <span style={styles.highlight}>Finance AI</span> Dashboard
                    </div>
                    <div style={styles.userInfo}>
                        <div style={styles.avatar}>{userName.charAt(0)}</div>
                        <span>{userName}</span>
                        <a href="/" style={styles.logoutBtn}>Sair</a>
                    </div>
                </div>
            </header>

            <main style={styles.main}>
                <div style={styles.sidebar} className="glass-panel">
                    <h3 style={styles.sidebarTitle}>Conexões</h3>
                    <div style={styles.connectionItem}>
                        <div style={styles.statusDot}></div>
                        <span>Conta Azul (Conectado)</span>
                    </div>

                    <h3 style={{ ...styles.sidebarTitle, marginTop: '2rem' }}>Ações Rápidas</h3>
                    <button style={styles.actionBtn}>Resumo Financeiro</button>
                    <button style={styles.actionBtn}>Análise de Vendas</button>
                    <button style={styles.actionBtn}>Contas a Receber</button>
                </div>

                <div style={styles.content}>
                    <ChatInterface />
                </div>
            </main>
        </div>
    );
}

const styles = {
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        background: 'radial-gradient(ellipse at top right, #1b2735 0%, #0d1117 100%)',
        minHeight: '100vh',
    },
    header: {
        padding: '1rem 2rem',
        position: 'sticky' as const,
        top: 0,
        zIndex: 10,
        borderRadius: '0 0 16px 16px',
        borderTop: 'none',
    },
    headerContent: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
    },
    logo: {
        fontSize: '1.25rem',
        fontWeight: 700,
    },
    highlight: {
        color: '#2F80ED',
    },
    userInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    avatar: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #2F80ED 0%, #56CCF2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        color: '#fff',
    },
    logoutBtn: {
        fontSize: '0.85rem',
        color: '#ff6b6b',
        marginLeft: '1rem',
        textDecoration: 'none',
    },
    main: {
        flex: 1,
        display: 'flex',
        padding: '2rem',
        gap: '2rem',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
    },
    sidebar: {
        width: '280px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1rem',
        height: 'fit-content',
    },
    sidebarTitle: {
        fontSize: '0.9rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        color: '#8b949e',
        marginBottom: '0.5rem',
    },
    connectionItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem',
        background: 'rgba(47, 128, 237, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(47, 128, 237, 0.2)',
        fontSize: '0.9rem',
        color: '#56CCF2',
    },
    statusDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#2ea043',
        boxShadow: '0 0 8px #2ea043',
    },
    actionBtn: {
        background: 'transparent',
        border: '1px solid var(--border-color)',
        color: 'var(--text-color)',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        textAlign: 'left' as const,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontSize: '0.9rem',
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
    }
};
