'use client';

import { useState, useEffect } from 'react';

interface SettingsMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsMenu({ isOpen, onClose }: SettingsMenuProps) {
    const [credentials, setCredentials] = useState({
        clientId: '',
        clientSecret: '',
        accessToken: '',
        refreshToken: ''
    });

    // Load current values from cookies/state on mount
    useEffect(() => {
        if (isOpen) {
            const getCookie = (name: string) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift();
                return '';
            };

            setCredentials({
                clientId: '', // Can't easily get from client-side if HttpOnly
                clientSecret: '',
                accessToken: getCookie('contaazul_access_token') || '',
                refreshToken: getCookie('contaazul_refresh_token') || ''
            });
        }
    }, [isOpen]);

    const handleSave = () => {
        // Function to set cookies
        const setCookie = (name: string, value: string, days: number) => {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
        };

        if (credentials.accessToken) {
            setCookie('contaazul_access_token', credentials.accessToken, 1 / 24); // 1 hour
        }
        if (credentials.refreshToken) {
            setCookie('contaazul_refresh_token', credentials.refreshToken, 30); // 30 days
        }

        alert('Configurações salvas localmente!');
        onClose();
        window.location.reload(); // Reload to apply changes in API calls
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Configurações de Conexão</h3>
                    <button style={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <div style={styles.body}>
                    <div style={styles.section}>
                        <label style={styles.label}>Conta Azul Access Token</label>
                        <textarea
                            style={styles.textarea}
                            value={credentials.accessToken}
                            onChange={e => setCredentials({ ...credentials, accessToken: e.target.value })}
                            placeholder="Cole o access_token aqui..."
                        />
                    </div>

                    <div style={styles.section}>
                        <label style={styles.label}>Conta Azul Refresh Token</label>
                        <textarea
                            style={styles.textarea}
                            value={credentials.refreshToken}
                            onChange={e => setCredentials({ ...credentials, refreshToken: e.target.value })}
                            placeholder="Cole o refresh_token aqui..."
                        />
                    </div>

                    <div style={styles.info}>
                        <p>ℹ️ Estes tokens são armazenados nos cookies do seu navegador para autenticar as requisições à API do Conta Azul.</p>
                    </div>
                </div>

                <div style={styles.footer}>
                    <button style={styles.cancelBtn} onClick={onClose}>Cancelar</button>
                    <button style={styles.saveBtn} onClick={handleSave}>Vincular Credenciais</button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modal: {
        width: '90%',
        maxWidth: '500px',
        backgroundColor: '#161b22',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    },
    header: {
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        margin: 0,
        color: 'white',
        fontSize: '1.25rem',
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#94a3b8',
        fontSize: '1.5rem',
        cursor: 'pointer',
    },
    body: {
        padding: '24px',
    },
    section: {
        marginBottom: '20px',
    },
    label: {
        display: 'block',
        color: '#94a3b8',
        marginBottom: '8px',
        fontSize: '0.875rem',
    },
    textarea: {
        width: '100%',
        height: '80px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        color: 'white',
        padding: '12px',
        fontSize: '0.875rem',
        outline: 'none',
        resize: 'none' as const,
    },
    info: {
        padding: '12px',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '8px',
        color: '#60a5fa',
        fontSize: '0.8125rem',
    },
    footer: {
        padding: '16px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    cancelBtn: {
        padding: '10px 20px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'none',
        color: 'white',
        cursor: 'pointer',
    },
    saveBtn: {
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        background: '#2563eb',
        color: 'white',
        fontWeight: '600' as const,
        cursor: 'pointer',
    }
};
