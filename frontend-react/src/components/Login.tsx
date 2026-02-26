import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock } from 'lucide-react';

const SignInForm: React.FC = () => {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!userId || !password) {
            setError('Please enter both User ID and Password');
            return;
        }

        setLoading(true);
        try {
            const user = await login(userId.trim(), password);
            // Programmatically navigate based on role
            navigate(user.role === 'supervisor' ? '/supervisor' : '/agent');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Login failed';
            if (msg === 'INVALID_CREDENTIALS' || msg === 'MISSING_CREDENTIALS') {
                setError('Invalid credentials. Please try again.');
            } else {
                setError(`Error: ${msg}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.card}>
            <div style={styles.header}>
                <h2 style={styles.title}>Welcome Back</h2>
                <p style={styles.subtitle}>Enter your credentials to access the terminal</p>
            </div>

            <form onSubmit={handleLogin} style={styles.form}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>User ID</label>
                    <div style={styles.inputWrapper}>
                        <User size={20} style={styles.inputIcon} />
                        <input
                            type="text"
                            placeholder="Enter your ID"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            style={styles.input}
                        />
                    </div>
                </div>

                <div style={styles.inputGroup}>
                    <label style={styles.label}>Password</label>
                    <div style={styles.inputWrapper}>
                        <Lock size={20} style={styles.inputIcon} />
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
                    {loading ? 'Authenticating...' : 'Sign In'}
                </button>
            </form>

            <p style={styles.footer}>
                Secure System Access • v2.4.0
            </p>
        </div>
    );
};

const Login: React.FC = () => {
    return (
        <div style={styles.container}>
            {/* Left Side - Restroboard Branding */}
            <div style={styles.leftPanel}>
                <div style={styles.decorationCircle} />
                <div style={styles.brandContainer}>
                    <h1 style={styles.brandTitle}>RestroBoard</h1>
                    <p style={styles.brandSubtitle}>
                        Analyze performance, track metrics, and optimize your workflow with real-time insights.
                    </p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div style={styles.rightPanel}>
                <SignInForm />
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        height: '100vh',
        display: 'flex',
        flexDirection: 'row',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-deep)',
    },
    leftPanel: {
        flex: 0.85,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        position: 'relative',
        overflow: 'hidden',
        borderRight: '1px solid var(--glass-border)',
    },
    rightPanel: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
    },
    brandContainer: {
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
    },
    brandTitle: {
        fontSize: '3.5rem',
        fontWeight: '800',
        color: 'var(--accent-yellow)',
        letterSpacing: '-0.03em',
        marginBottom: '1rem',
        background: 'linear-gradient(to bottom right, var(--accent-yellow) 30%, #a16207 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    brandSubtitle: {
        fontSize: '1.1rem',
        color: 'var(--text-secondary)',
        maxWidth: '380px',
        lineHeight: '1.6',
        fontWeight: '500',
    },
    decorationCircle: {
        position: 'absolute',
        width: '1000px',
        height: '1000px',
        borderRadius: '50%',
        background: 'var(--aura-glow)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 0,
    },
    card: {
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        zIndex: 10,
        background: 'var(--glass-bg)',
        padding: '3rem',
        borderRadius: '24px',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-premium)',
    },
    header: {
        textAlign: 'left',
        marginBottom: '0.5rem',
    },
    title: {
        fontSize: '2rem',
        fontWeight: '700',
        color: 'var(--accent-yellow)',
        letterSpacing: '-0.02em',
        marginBottom: '0.5rem',
        background: 'linear-gradient(to bottom right, var(--accent-yellow) 30%, var(--accent-blue) 120%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        color: 'var(--text-secondary)',
        fontSize: '0.95rem',
        fontWeight: '400',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    label: {
        fontSize: '0.8rem',
        fontWeight: '600',
        color: 'var(--text-muted)',
        marginLeft: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    inputIcon: {
        position: 'absolute',
        left: '16px',
        color: 'var(--text-muted)',
        transition: 'color 0.2s',
    },
    input: {
        width: '100%',
        background: 'var(--bg-deep)',
        border: '1px solid var(--glass-border)',
        padding: '1.1rem 1.1rem 1.1rem 3rem',
        borderRadius: '14px',
        color: 'var(--text-primary)',
        outline: 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        fontSize: '0.95rem',
        fontWeight: '500',
    },
    error: {
        color: '#ef4444',
        fontSize: '0.875rem',
        textAlign: 'center',
        background: 'rgba(239, 68, 68, 0.1)',
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        fontWeight: '500',
    },
    loginBtn: {
        background: 'linear-gradient(to right, var(--accent-yellow), #eab308)',
        color: '#000000',
        border: 'none',
        padding: '1.1rem',
        borderRadius: '14px',
        fontWeight: '700',
        fontSize: '0.95rem',
        marginTop: '0.5rem',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: 'var(--shadow-premium)',
    },
    footer: {
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        marginTop: '2rem',
        fontWeight: '500',
    }
};

export default Login;
