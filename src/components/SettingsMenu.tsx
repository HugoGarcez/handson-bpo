'use client';

import { useState } from 'react';

interface SettingsMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsMenu({ isOpen, onClose }: SettingsMenuProps) {
    const [accessToken, setAccessToken] = useState('');
    const [refreshToken, setRefreshToken] = useState('');
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSave = async () => {
        if (!accessToken && !refreshToken) {
            setStatus('error');
            setMessage('Cole ao menos um token antes de salvar.');
            return;
        }
        setStatus('saving');
        setMessage('');
        try {
            const res = await fetch('/api/auth/set-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken, refreshToken }),
            });

            if (res.ok) {
                setStatus('success');
                setMessage('✅ Tokens salvos! A IA já pode acessar seus dados.');
                setTimeout(() => {
                    onClose();
                    window.location.reload();
                }, 1500);
            } else {
                setStatus('error');
                setMessage('❌ Erro ao salvar tokens. Tente novamente.');
            }
        } catch {
            setStatus('error');
            setMessage('❌ Erro de conexão. Tente novamente.');
        }
    };

    const handleClear = async () => {
        await fetch('/api/auth/set-token', { method: 'DELETE' });
        setStatus('success');
        setMessage('✅ Tokens removidos.');
        setTimeout(() => { onClose(); window.location.reload(); }, 1000);
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.header}>
                    <div>
                        <h3 style={styles.title}>🔑 Conexão com Conta Azul</h3>
                        <p style={styles.subtitle}>Insira seus tokens manualmente para conectar a conta.</p>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div style={styles.body}>
                    <div style={styles.howTo}>
                        <strong>Como obter seus tokens:</strong>
                        <ol style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.8 }}>
                            <li>Acesse o Conta Azul e faça login.</li>
                            <li>Abra o DevTools (F12) → aba <strong>Application</strong>.</li>
                            <li>Em <strong>Cookies</strong>, copie os valores de <code>access_token</code> e <code>refresh_token</code>.</li>
                        </ol>
                    </div>

                    <div style={styles.section}>
                        <label style={styles.label}>Access Token <span style={{ color: '#f87171' }}>*</span></label>
                        <textarea
                            style={styles.textarea}
                            value={accessToken}
                            onChange={e => setAccessToken(e.target.value)}
                            placeholder="Cole o access_token aqui... (eyJ...)"
                        />
                    </div>

                    <div style={styles.section}>
                        <label style={styles.label}>Refresh Token <span style={{ color: '#94a3b8' }}>(opcional)</span></label>
                        <textarea
                            style={styles.textarea}
                            value={refreshToken}
                            onChange={e => setRefreshToken(e.target.value)}
                            placeholder="Cole o refresh_token aqui..."
                        />
                    </div>

                    {message && (
                        <div style={{
                            ...styles.statusMsg,
                            backgroundColor: status === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: status === 'success' ? '#4ade80' : '#f87171',
                        }}>
                            {message}
                        </div>
                    )}
                </div>

                <div style={styles.footer}>
                    <button style={styles.clearBtn} onClick={handleClear} title="Remover tokens e desconectar">
                        Desconectar
                    </button>
                    <button
                        style={{ ...styles.saveBtn, opacity: status === 'saving' ? 0.7 : 1 }}
                        onClick={handleSave}
                        disabled={status === 'saving'}
                    >
                        {status === 'saving' ? 'Salvando...' : 'Conectar Conta Azul'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed' as const,
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
    },
    modal: {
        width: '90%', maxWidth: '540px',
        backgroundColor: '#0d1117',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
    },
    header: {
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    },
    title: { margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: 700 },
    subtitle: { margin: '4px 0 0', color: '#94a3b8', fontSize: '0.8125rem' },
    closeBtn: {
        background: 'none', border: 'none', color: '#94a3b8',
        fontSize: '1.2rem', cursor: 'pointer', padding: '4px',
    },
    body: { padding: '20px 24px' },
    howTo: {
        padding: '12px 16px',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderRadius: '10px',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        color: '#94a3b8',
        fontSize: '0.8125rem',
        marginBottom: '20px',
    },
    section: { marginBottom: '16px' },
    label: { display: 'block', color: '#94a3b8', marginBottom: '8px', fontSize: '0.875rem' },
    textarea: {
        width: '100%', height: '72px', boxSizing: 'border-box' as const,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px', color: '#e2e8f0',
        padding: '10px 12px', fontSize: '0.8125rem',
        outline: 'none', resize: 'none' as const, fontFamily: 'monospace',
    },
    statusMsg: {
        padding: '10px 14px', borderRadius: '8px',
        fontSize: '0.875rem', marginTop: '8px',
    },
    footer: {
        padding: '16px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex', justifyContent: 'space-between', gap: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    clearBtn: {
        padding: '10px 16px', borderRadius: '8px',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#f87171', cursor: 'pointer', fontSize: '0.875rem',
    },
    saveBtn: {
        padding: '10px 20px', borderRadius: '8px',
        border: 'none', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
        color: 'white', fontWeight: 600 as const, cursor: 'pointer', fontSize: '0.875rem',
        flex: 1,
    },
};
