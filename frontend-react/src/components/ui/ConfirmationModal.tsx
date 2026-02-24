import React from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'CONFIRM',
    cancelText = 'CANCEL',
    type = 'warning'
}) => {
    if (!isOpen) return null;

    const getColors = () => {
        switch (type) {
            case 'danger': return { primary: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', bg: 'rgba(239, 68, 68, 0.1)' };
            case 'info': return { primary: '#60a5fa', border: 'rgba(96, 165, 250, 0.3)', bg: 'rgba(96, 165, 250, 0.1)' };
            default: return { primary: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)', bg: 'rgba(251, 191, 36, 0.1)' };
        }
    };

    const colors = getColors();

    return createPortal(
        <div style={styles.overlay}>
            <div className="glass-card enter-animation" style={{ ...styles.modal, borderColor: colors.border }}>
                <div style={styles.header}>
                    <div style={{ ...styles.iconWrapper, background: colors.bg }}>
                        <ShieldAlert size={24} color={colors.primary} />
                    </div>
                    <div style={styles.headerText}>
                        <h3 style={styles.title}>{title}</h3>
                        <p style={styles.message}>{message}</p>
                    </div>
                    <button onClick={onCancel} style={styles.closeBtn}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                <div style={styles.footer}>
                    <button style={styles.cancelBtn} onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button
                        style={{ ...styles.confirmBtn, background: colors.primary, boxShadow: `0 0 15px ${colors.primary}66` }}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11000,
    },
    modal: {
        width: '420px',
        padding: '24px',
        background: 'rgba(15, 23, 42, 0.95)',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    },
    header: {
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
    },
    iconWrapper: {
        padding: '12px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    title: {
        fontSize: '1.1rem',
        fontWeight: '900',
        color: 'white',
        letterSpacing: '0.05em',
        margin: 0,
        textTransform: 'uppercase',
    },
    message: {
        fontSize: '0.9rem',
        color: 'var(--text-secondary)',
        margin: 0,
        lineHeight: '1.5',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        padding: '4px',
        cursor: 'pointer',
        opacity: 0.6,
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
    },
    cancelBtn: {
        padding: '10px 20px',
        borderRadius: '10px',
        border: '1px solid var(--glass-border)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    confirmBtn: {
        padding: '10px 24px',
        borderRadius: '10px',
        border: 'none',
        color: 'black',
        fontSize: '0.85rem',
        fontWeight: '900',
        cursor: 'pointer',
        transition: 'all 0.2s',
    }
};

export default ConfirmationModal;
