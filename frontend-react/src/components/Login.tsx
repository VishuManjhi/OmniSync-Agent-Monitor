import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock } from 'lucide-react';

const SignInForm: React.FC = () => {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!userId || !password) {
            setError('Please enter both User ID and Password');
            return;
        }

        setLoading(true);

        // Mock auth logic: Auto-detect role
        setTimeout(() => {
            const id = userId.toLowerCase().trim();
            let detectedRole: 'agent' | 'supervisor' | null = null;

            if (id.startsWith('a') && password === 'agent123') {
                detectedRole = 'agent';
            } else if ((id === 'admin' || id.startsWith('sup')) && password === 'sup123') {
                detectedRole = 'supervisor';
            }

            if (detectedRole) {
                login(id, detectedRole);
            } else {
                setError('Invalid credentials. Please try again.');
            }
            setLoading(false);
        }, 800);
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
        background: 'radial-gradient(circle at center, #0a0a0a 0%, #000000 100%)',
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
        borderRight: '1px solid rgba(255, 255, 255, 0.03)',
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
        color: '#facc15',
        letterSpacing: '-0.03em',
        marginBottom: '1rem',
        background: 'linear-gradient(to bottom right, #facc15 30%, #a16207 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    brandSubtitle: {
        fontSize: '1.1rem',
        color: '#525252',
        maxWidth: '380px',
        lineHeight: '1.6',
        fontWeight: '500',
    },
    decorationCircle: {
        position: 'absolute',
        width: '1000px',
        height: '1000px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(20, 20, 20, 1) 0%, transparent 60%)',
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
        // Added card styles: Dark golden background
        background: 'linear-gradient(135deg, #1c1905 0%, #171500 50%, #0a0a0a 100%)',
        padding: '3rem',
        borderRadius: '24px',
        border: '1px solid rgba(250, 204, 21, 0.15)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
    },
    header: {
        textAlign: 'left',
        marginBottom: '0.5rem',
    },
    title: {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#facc15',
        letterSpacing: '-0.02em',
        marginBottom: '0.5rem',
        background: 'linear-gradient(to bottom right, #facc15 30%, #a16207 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        color: '#737373', // Lightened slightly for better contrast on dark bg
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
        color: '#a1a1aa', // Lightened for better visibility
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
        color: '#737373',
        transition: 'color 0.2s',
    },
    input: {
        width: '100%',
        background: 'rgba(0, 0, 0, 0.3)', // Darker input bg
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '1.1rem 1.1rem 1.1rem 3rem',
        borderRadius: '14px',
        color: '#ffffff',
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
        background: 'linear-gradient(to right, #facc15, #eab308)',
        color: '#000000',
        border: 'none',
        padding: '1.1rem',
        borderRadius: '14px',
        fontWeight: '700',
        fontSize: '0.95rem',
        marginTop: '0.5rem',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 12px rgba(250, 204, 21, 0.2)',
    },
    footer: {
        fontSize: '0.75rem',
        color: '#525252',
        textAlign: 'center',
        marginTop: '2rem',
        fontWeight: '500',
    }
};

export default Login;
