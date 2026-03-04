

export default function Home() {
  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.hero}>
        <h1 style={styles.title}>
          Bem-vindo ao <span style={styles.highlight}>Finance AI</span>
        </h1>
        <p style={styles.subtitle}>
          Conecte sua conta do Conta Azul e gere relatórios dinâmicos e inteligentes
          em questão de segundos.
        </p>
      </div>

      <div style={styles.loginCard} className="glass-panel">
        <h2 style={{ marginBottom: '1.5rem', fontWeight: 600 }}>Acesse sua Conta</h2>

        <p style={{ marginBottom: '2rem', color: '#8b949e', fontSize: '0.95rem' }}>
          Para começar, precisamos conectar com o seu Conta Azul.
          A autenticação é feita de forma segura através do OAuth 2.0.
        </p>

        <a href="/api/auth/contaazul" className="btn-primary" style={styles.linkButton}>
          <svg style={{ width: '20px', height: '20px', marginRight: '10px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Conectar com Conta Azul
        </a>

        <div style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#8b949e' }}>
          * Você será redirecionado para a página oficial do Conta Azul.
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: 'radial-gradient(ellipse at top, #1b2735 0%, #0d1117 100%)',
  },
  hero: {
    textAlign: 'center' as const,
    marginBottom: '4rem',
    maxWidth: '600px',
  },
  title: {
    fontSize: '3.5rem',
    fontWeight: 800,
    marginBottom: '1rem',
    letterSpacing: '-0.05em',
  },
  highlight: {
    background: 'linear-gradient(135deg, #2F80ED 0%, #56CCF2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#8b949e',
    lineHeight: 1.6,
  },
  loginCard: {
    padding: '3rem',
    maxWidth: '450px',
    width: '100%',
    textAlign: 'center' as const,
  },
  linkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    textDecoration: 'none',
  }
};
