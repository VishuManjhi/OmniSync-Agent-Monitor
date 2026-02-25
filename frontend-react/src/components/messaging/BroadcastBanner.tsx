import React from 'react';
import { useMessaging } from '../../context/MessagingContext';
import { useAuth } from '../../context/AuthContext';
import { Megaphone, X } from 'lucide-react';

const BroadcastBanner: React.FC = () => {
    const { user } = useAuth();
    const { broadcasts, clearBroadcast } = useMessaging();

    if (broadcasts.length === 0) return null;

    // Filter out:
    // 1. Broadcasts sent by ME
    // 2. Broadcasts older than 24 hours
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const activeBroadcasts = broadcasts.filter(b =>
        b.senderId !== user?.id &&
        (Date.now() - b.timestamp) < ONE_DAY
    );

    if (activeBroadcasts.length === 0) return null;

    const latest = activeBroadcasts[0];

    return (
        <div style={styles.banner} className="broadcast-banner glass-card animate-slide-down">
            <div style={styles.content}>
                <div style={styles.iconBox}>
                    <Megaphone size={18} />
                </div>
                <div style={styles.textGroup}>
                    <span style={styles.title}>SYSTEM ALERT</span>
                    <p style={styles.message}>{latest.content}</p>
                </div>
            </div>
            <button onClick={() => clearBroadcast(latest._id)} style={styles.closeBtn}>
                <X size={18} />
            </button>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    banner: {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: '90%',
        maxWidth: '800px',
        background: 'rgba(239, 68, 68, 0.15)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(239, 68, 68, 0.2)',
    },
    content: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    iconBox: {
        background: 'rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
        padding: '10px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    title: {
        fontSize: '0.7rem',
        fontWeight: '900',
        color: '#ef4444',
        letterSpacing: '0.1em',
    },
    message: {
        fontSize: '0.95rem',
        fontWeight: '700',
        color: 'white',
        margin: 0,
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.5)',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    }
};

export default BroadcastBanner;
