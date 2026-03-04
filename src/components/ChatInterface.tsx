'use client';

import { C1Chat } from "@thesysai/genui-sdk";
import { ThemeProvider } from "@crayonai/react-ui";

export default function ChatInterface() {
    return (
        <ThemeProvider>
            <div style={styles.container} className="glass-panel">
                {/* The C1Chat manages its own state and streams from /api/chat */}
                <C1Chat apiUrl="/api/chat" />
            </div>
        </ThemeProvider>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        height: '100%',
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'hidden',
        background: 'rgba(13, 17, 23, 0.4)',
        borderRadius: '16px',
        padding: '1rem',
    }
};
