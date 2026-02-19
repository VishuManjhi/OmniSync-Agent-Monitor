import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, User, ShieldCheck, Mail, Lock } from 'lucide-react';

const Login: React.FC = () => {
    const [role, setRole] = useState<'agent' | 'supervisor'>('agent');
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!userId || !password) {
            setError('Please enter both ID and Password');
            return;
        }

        setLoading(true);

        // Mock auth logic matching existing app
        setTimeout(() => {
            const id = userId.toLowerCase();

            // Simple validation matching existing app
            if (role === 'agent') {
                if (id.startsWith('a') && password === 'agent123') {
                    login(id, 'agent');
                } else {
                    setError('Invalid Agent credentials');
                }
            } else {
                if ((id === 'admin' || id.startsWith('sup')) && password === 'sup123') {
                    login(id, 'supervisor');
                } else {
                    setError('Invalid Supervisor credentials');
                }
            }
            setLoading(false);
        }, 800);
    };

    return (
        <div className="login-container" style={styles.container}>
            <div className="glass-card" style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.iconContainer}>
                        <LogIn size={24} color="var(--accent-yellow)" />
                    </div>
                    <h2 style={styles.title}>RestroBoard</h2>
                    <p style={styles.subtitle}>Secure Access • Command Terminal</p>
                </div>

                <div style={styles.tabContainer}>
                    <button
                        style={{ ...styles.tab, ...(role === 'agent' ? styles.activeTab : {}) }}
                        onClick={() => setRole('agent')}
                    >
                        <User size={16} /> Agent
                    </button>
                    <button
                        style={{ ...styles.tab, ...(role === 'supervisor' ? styles.activeTab : {}) }}
                        onClick={() => setRole('supervisor')}
                    >
                        <ShieldCheck size={16} /> Supervisor
                    </button>
                </div>

                <form onSubmit={handleLogin} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>{role === 'agent' ? 'Agent ID' : 'Supervisor ID'}</label>
                        <div style={styles.inputWrapper}>
                            <Mail size={18} style={styles.inputIcon} />
                            <input
                                type="text"
                                placeholder={role === 'agent' ? 'AGENT ID' : 'SUPERVISOR ID'}
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                style={styles.input}
                            />
                        </div>
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Security Token</label>
                        <div style={styles.inputWrapper}>
                            <Lock size={18} style={styles.inputIcon} />
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={styles.input}
                            />
                        </div>
                    </div>

                    {error && <p style={styles.error}>{error}</p>}

                    <button type="submit" disabled={loading} style={styles.loginBtn}>
                        {loading ? 'Authenticating...' : 'Establish Connection'}
                    </button>
                </form>

                <p style={styles.footer}>
                    Secure biometric encryption active.
                </p>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
    },
    card: {
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
    },
    header: {
        textAlign: 'center',
    },
    iconContainer: {
        width: '56px',
        height: '56px',
        borderRadius: '12px',
        background: 'rgba(250, 204, 21, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem',
        border: '1px solid rgba(250, 204, 21, 0.1)',
    },
    title: {
        fontSize: '2.25rem',
        fontWeight: '900',
        color: 'var(--accent-yellow)',
        letterSpacing: '-0.04em',
        textTransform: 'uppercase',
    },
    subtitle: {
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
        marginTop: '0.5rem',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        fontWeight: '700',
    },
    tabContainer: {
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        padding: '4px',
        display: 'flex',
        gap: '4px',
    },
    tab: {
        flex: 1,
        padding: '0.625rem',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-muted)',
        borderRadius: '8px',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: '600',
    },
    activeTab: {
        background: 'var(--accent-blue)',
        color: '#ffffff',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.8125rem',
        fontWeight: '600',
        color: 'var(--text-secondary)',
        marginLeft: '4px',
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    inputIcon: {
        position: 'absolute',
        left: '12px',
        color: 'var(--text-muted)',
    },
    input: {
        width: '100%',
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--glass-border)',
        padding: '0.875rem 0.875rem 0.875rem 2.5rem',
        borderRadius: '8px',
        color: 'white',
        outline: 'none',
        transition: 'all 0.2s',
        fontSize: '0.9rem',
    },
    error: {
        color: '#f87171',
        fontSize: '0.8125rem',
        textAlign: 'center',
        background: 'rgba(248, 113, 113, 0.1)',
        padding: '8px',
        borderRadius: '8px',
        border: '1px solid rgba(248, 113, 113, 0.2)',
    },
    loginBtn: {
        background: 'var(--accent-yellow)',
        color: 'var(--bg-deep)',
        border: 'none',
        padding: '1rem',
        borderRadius: '8px',
        fontWeight: '800',
        fontSize: '0.9rem',
        marginTop: '0.5rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        boxShadow: '0 10px 20px -10px rgba(250, 204, 21, 0.3)',
    },
    footer: {
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
    }
};

export default Login;
