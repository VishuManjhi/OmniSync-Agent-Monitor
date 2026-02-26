import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '../../context/NotificationContext';
import { CheckCircle, AlertCircle, Info, ShieldAlert, X } from 'lucide-react';

const NotificationContainer: React.FC = () => {
    const { notifications, removeNotification } = useNotification();

    return createPortal(
        <div style={styles.container}>
            {notifications.map(n => (
                <Toast key={n.id} notification={n} onDismiss={() => removeNotification(n.id)} />
            ))}
        </div>,
        document.body
    );
};

const Toast: React.FC<{ notification: any; onDismiss: () => void }> = ({ notification, onDismiss }) => {
    const [isExiting, setIsExiting] = useState(false);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(onDismiss, 300);
    };

    const getIcon = () => {
        switch (notification.type) {
            case 'success': return <CheckCircle size={20} color="#34d399" />;
            case 'error': return <ShieldAlert size={20} color="#f87171" />;
            case 'warning': return <AlertCircle size={20} color="#fbbf24" />;
            default: return <Info size={20} color="#60a5fa" />;
        }
    };

    const getBorderColor = () => {
        switch (notification.type) {
            case 'success': return '#34d39944';
            case 'error': return '#f8717144';
            case 'warning': return '#fbbf2444';
            default: return '#60a5fa44';
        }
    };

    const getToastBackground = () => {
        const theme = document.documentElement.getAttribute('data-theme');
        return theme === 'light' ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 23, 42, 0.88)';
    };

    return (
        <div
            className={`glass-card ${isExiting ? 'exit-animation' : 'enter-animation'}`}
            style={{
                ...styles.toast,
                borderColor: getBorderColor(),
                background: getToastBackground(),
                opacity: isExiting ? 0 : 1,
                transform: isExiting ? 'translateX(100%)' : 'translateX(0)'
            }}
        >
            <div style={styles.iconWrapper}>
                {getIcon()}
            </div>
            <div style={styles.content}>
                {notification.title && <div style={styles.title}>{notification.title}</div>}
                <div style={styles.message}>{notification.message}</div>
            </div>
            <button onClick={handleDismiss} style={styles.closeBtn}>
                <X size={16} color="var(--text-muted)" />
            </button>
            <div style={{ ...styles.progressBar, background: getBorderColor().replace('44', '') }} />
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none',
    },
    toast: {
        pointerEvents: 'all',
        width: '320px',
        padding: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    iconWrapper: {
        marginTop: '2px',
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    title: {
        fontSize: '0.85rem',
        fontWeight: '900',
        textTransform: 'none',
        letterSpacing: '0.05em',
        color: 'var(--text-primary)',
    },
    message: {
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        lineHeight: '1.4',
        fontWeight: '500',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        padding: '4px',
        cursor: 'pointer',
        opacity: 0.6,
        transition: 'opacity 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: '3px',
        width: '100%',
        animation: 'progress 5s linear forwards',
    }
};

// Add animations via style tag if not in CSS file
if (!document.getElementById('notification-animations')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'notification-animations';
    styleTag.innerHTML = `
        @keyframes progress {
            from { width: 100%; }
            to { width: 0%; }
        }
        .enter-animation {
            animation: enter 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes enter {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(styleTag);
}

export default NotificationContainer;
