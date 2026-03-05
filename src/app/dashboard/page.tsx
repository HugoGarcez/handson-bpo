'use client';

import ChatInterface from '@/components/ChatInterface';

export default function Dashboard() {
    return (
        <div style={styles.fullscreen}>
            <ChatInterface />
        </div>
    );
}

const styles = {
    fullscreen: {
        width: '100vw',
        height: '100vh',
        background: '#0d1117',
    }
};
