import React, { useState, useRef, useEffect } from 'react';
import { useMessaging } from '../../context/MessagingContext';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, X, Send, LifeBuoy } from 'lucide-react';

const HelpChatWidget: React.FC = () => {
    const { user } = useAuth();
    const { messages, sendMessage } = useMessaging();
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages update
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        sendMessage(content, 'SUPERVISORS', 'HELP_REQUEST');
        setContent('');
    };

    // Filter messages for this chat (sent by me or to me)
    const chatMessages = messages.filter(m =>
        m.senderId === user?.id || m.receiverId === user?.id
    );

    return (
        <div style={styles.shell}>
            {!isOpen ? (
                <button onClick={() => setIsOpen(true)} style={styles.trigger} className="hover-glow">
                    <LifeBuoy size={24} />
                    <span style={styles.triggerText}>HELP REQUEST</span>
                </button>
            ) : (
                <div style={styles.widget} className="glass-card animate-slide-up">
                    <header style={styles.header}>
                        <div style={styles.headerTitle}>
                            <LifeBuoy size={16} />
                            <span>INTERNAL SUPPORT</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>
                            <X size={16} />
                        </button>
                    </header>

                    <div style={styles.chatArea} ref={scrollRef}>
                        {chatMessages.length === 0 ? (
                            <div style={styles.emptyState}>
                                <MessageSquare size={32} opacity={0.2} />
                                <p>Describe your issue to start a live support session.</p>
                            </div>
                        ) : (
                            chatMessages.map((m, i) => (
                                <div
                                    key={m._id || i}
                                    style={{
                                        ...styles.msgBubble,
                                        alignSelf: m.senderId === user?.id ? 'flex-end' : 'flex-start',
                                        background: m.senderId === user?.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                                        borderColor: m.senderId === user?.id ? 'rgba(59, 130, 246, 0.3)' : 'var(--glass-border)'
                                    }}
                                >
                                    <span style={styles.msgContent}>{m.content}</span>
                                    <span style={styles.msgTime}>
                                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleSend} style={styles.inputForm}>
                        <input
                            style={styles.input}
                            placeholder="Type a message..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        <button type="submit" style={styles.sendBtn} disabled={!content.trim()}>
                            <Send size={16} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    shell: {
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 9000,
    },
    trigger: {
        background: 'var(--accent-blue)',
        color: 'white',
        border: 'none',
        borderRadius: '50px',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontWeight: '900',
        cursor: 'pointer',
        boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)',
    },
    triggerText: {
        fontSize: '0.85rem',
        letterSpacing: '0.05em',
    },
    widget: {
        width: '320px',
        height: '450px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        borderRadius: '20px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    },
    header: {
        padding: '16px',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.02)',
    },
    headerTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.75rem',
        fontWeight: '900',
        color: 'var(--accent-blue)',
        letterSpacing: '0.1em',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: 'pointer',
    },
    chatArea: {
        flex: 1,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto',
    },
    emptyState: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: 'var(--text-muted)',
        padding: '0 20px',
        fontSize: '0.85rem',
    },
    msgBubble: {
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: '14px',
        border: '1px solid transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    msgContent: {
        fontSize: '0.9rem',
        color: 'white',
        lineHeight: '1.4',
    },
    msgTime: {
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        alignSelf: 'flex-end',
    },
    inputForm: {
        padding: '16px',
        borderTop: '1px solid var(--glass-border)',
        display: 'flex',
        gap: '10px',
        background: 'rgba(255,255,255,0.02)',
    },
    input: {
        flex: 1,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--glass-border)',
        borderRadius: '10px',
        padding: '8px 12px',
        color: 'white',
        fontSize: '0.85rem',
        outline: 'none',
    },
    sendBtn: {
        background: 'var(--accent-blue)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
    }
};

export default HelpChatWidget;
