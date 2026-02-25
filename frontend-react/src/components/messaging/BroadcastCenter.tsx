import React, { useState } from 'react';
import { useMessaging } from '../../context/MessagingContext';
import { useAuth } from '../../context/AuthContext';
import { Megaphone, MessageSquare, Send, Users, LifeBuoy, Search } from 'lucide-react';
import type { Agent } from '../../api/types';

interface BroadcastCenterProps {
    agents: Agent[];
}

const BroadcastCenter: React.FC<BroadcastCenterProps> = ({ agents }) => {
    const { user } = useAuth();
    const { messages, broadcasts, sendMessage } = useMessaging();
    const [broadcastContent, setBroadcastContent] = useState('');
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');

    // Targeted Messaging State
    const [transmitTarget, setTransmitTarget] = useState<'ALL' | 'AGENT'>('ALL');
    const [targetSearch, setTargetSearch] = useState('');
    const [selectedTargetAgent, setSelectedTargetAgent] = useState<Agent | null>(null);

    const handleSendBroadcast = (e: React.FormEvent) => {
        e.preventDefault();
        if (!broadcastContent.trim()) return;

        if (transmitTarget === 'ALL') {
            sendMessage(broadcastContent, undefined, 'ADMIN_BROADCAST');
        } else if (selectedTargetAgent) {
            sendMessage(broadcastContent, selectedTargetAgent.agentId, 'CHAT_MESSAGE');
        }

        setBroadcastContent('');
        setSelectedTargetAgent(null);
        setTargetSearch('');
    };

    const handleSendReply = (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyContent.trim() || !selectedAgentId) return;
        sendMessage(replyContent, selectedAgentId, 'CHAT_MESSAGE');
        setReplyContent('');
    };

    // Filter agents for search
    const searchedAgents = agents.filter(a =>
        a.name.toLowerCase().includes(targetSearch.toLowerCase()) ||
        a.agentId.toLowerCase().includes(targetSearch.toLowerCase())
    ).slice(0, 5);

    // Group messages by agent for the help request list
    const helpRequests = messages.filter(m => m.type === 'HELP_REQUEST' || (m.type === 'CHAT' && (m.senderId === user?.id || m.receiverId === user?.id)));
    const uniqueAgents = Array.from(new Set(helpRequests.map(m => m.senderId !== user?.id ? m.senderId : m.receiverId))).filter(Boolean) as string[];

    const activeChatMessages = helpRequests.filter(m =>
        (m.senderId === selectedAgentId && (m.receiverId === user?.id || m.receiverId === 'SUPERVISORS' || !m.receiverId)) ||
        (m.senderId === user?.id && m.receiverId === selectedAgentId)
    );

    return (
        <div style={styles.container}>
            <div style={styles.layout}>
                {/* Left: Broadcast Tool */}
                <section className="glass-card" style={styles.broadcastSection}>
                    <div style={styles.sectionHeader}>
                        <Megaphone size={18} color="var(--accent-yellow)" />
                        <h3 style={styles.sectionTitle}>Transmission Center</h3>
                    </div>

                    <div style={styles.targetToggle}>
                        <button
                            onClick={() => setTransmitTarget('ALL')}
                            style={{ ...styles.toggleBtn, ...(transmitTarget === 'ALL' ? styles.toggleActive : {}) }}
                        >
                            BROADCAST ALL
                        </button>
                        <button
                            onClick={() => setTransmitTarget('AGENT')}
                            style={{ ...styles.toggleBtn, ...(transmitTarget === 'AGENT' ? styles.toggleActive : {}) }}
                        >
                            TARGET AGENT
                        </button>
                    </div>

                    {transmitTarget === 'AGENT' && (
                        <div style={styles.searchContainer}>
                            <div style={styles.searchInputWrapper}>
                                <Search size={14} style={styles.searchIcon} />
                                <input
                                    style={styles.targetSearchInput}
                                    placeholder="Search agent name or ID..."
                                    value={targetSearch}
                                    onChange={(e) => setTargetSearch(e.target.value)}
                                />
                            </div>

                            {targetSearch && !selectedTargetAgent && (
                                <div style={styles.searchResults}>
                                    {searchedAgents.map(a => (
                                        <div
                                            key={a.agentId}
                                            style={styles.searchItem}
                                            onClick={() => {
                                                setSelectedTargetAgent(a);
                                                setTargetSearch('');
                                            }}
                                        >
                                            <span style={styles.searchName}>{a.name}</span>
                                            <span style={styles.searchId}>{a.agentId}</span>
                                        </div>
                                    ))}
                                    {searchedAgents.length === 0 && (
                                        <div style={styles.searchEmpty}>No agents found</div>
                                    )}
                                </div>
                            )}

                            {selectedTargetAgent && (
                                <div style={styles.selectedTarget}>
                                    <div style={styles.targetInfo}>
                                        <Users size={12} />
                                        <span>Targeting: <strong>{selectedTargetAgent.name}</strong></span>
                                    </div>
                                    <button
                                        style={styles.clearTarget}
                                        onClick={() => setSelectedTargetAgent(null)}
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSendBroadcast} style={styles.broadcastForm}>
                        <textarea
                            style={styles.broadcastInput}
                            placeholder={transmitTarget === 'ALL' ? "Type an announcement for ALL agents..." : "Type a private message..."}
                            value={broadcastContent}
                            onChange={(e) => setBroadcastContent(e.target.value)}
                        />
                        <button type="submit" style={styles.broadcastBtn} disabled={!broadcastContent.trim() || (transmitTarget === 'AGENT' && !selectedTargetAgent)}>
                            <Send size={16} /> {transmitTarget === 'ALL' ? 'TRANSMIT ALERT' : 'SEND MESSAGE'}
                        </button>
                    </form>

                    <div style={styles.historyList}>
                        <span style={styles.historyLabel}>RECENT TRANSMISSIONS</span>
                        {broadcasts.length === 0 ? (
                            <p style={styles.emptyText}>No recent alerts</p>
                        ) : (
                            broadcasts.slice(0, 3).map(b => (
                                <div key={b._id} style={styles.historyItem}>
                                    <span style={styles.historyContent}>{b.content}</span>
                                    <span style={styles.historyTime}>{new Date(b.timestamp).toLocaleTimeString()}</span>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Right: Live Support */}
                <section className="glass-card" style={styles.supportSection}>
                    <div style={styles.sectionHeader}>
                        <LifeBuoy size={18} color="var(--accent-blue)" />
                        <h3 style={styles.sectionTitle}>Agent Support Desk</h3>
                    </div>

                    <div style={styles.supportShell}>
                        <div style={styles.agentList}>
                            {uniqueAgents.length === 0 ? (
                                <div style={styles.emptyState}>
                                    <Users size={24} opacity={0.2} />
                                    <span>No active requests</span>
                                </div>
                            ) : (
                                uniqueAgents.map(agentId => (
                                    <button
                                        key={agentId}
                                        onClick={() => setSelectedAgentId(agentId)}
                                        style={{
                                            ...styles.agentItem,
                                            background: selectedAgentId === agentId ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                            borderColor: selectedAgentId === agentId ? 'var(--accent-blue)' : 'transparent'
                                        }}
                                    >
                                        <div style={styles.agentAvatar}>{agentId[0].toUpperCase()}</div>
                                        <div style={styles.agentMeta}>
                                            <span style={styles.agentIdName}>{agentId}</span>
                                            <span style={styles.agentSub}>Live Session</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        <div style={styles.chatArea}>
                            {selectedAgentId ? (
                                <>
                                    <div style={styles.chatHeader}>
                                        <span style={styles.chatTitle}>Chatting with {selectedAgentId}</span>
                                    </div>
                                    <div style={styles.messages}>
                                        {activeChatMessages.map((m, i) => (
                                            <div
                                                key={m._id || i}
                                                style={{
                                                    ...styles.bubble,
                                                    alignSelf: m.senderId === user?.id ? 'flex-end' : 'flex-start',
                                                    background: m.senderId === user?.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                                                    borderColor: m.senderId === user?.id ? 'rgba(59, 130, 246, 0.3)' : 'var(--glass-border)'
                                                }}
                                            >
                                                <span style={styles.bubbleText}>{m.content}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <form onSubmit={handleSendReply} style={styles.replyForm}>
                                        <input
                                            style={styles.replyInput}
                                            placeholder="Type a reply..."
                                            value={replyContent}
                                            onChange={(e) => setReplyContent(e.target.value)}
                                        />
                                        <button type="submit" style={styles.replyBtn} disabled={!replyContent.trim()}>
                                            <Send size={14} />
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div style={styles.chatPlaceholder}>
                                    <MessageSquare size={48} opacity={0.1} />
                                    <p>Select an agent to begin live support</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    layout: {
        display: 'grid',
        gridTemplateColumns: '350px 1fr',
        gap: '1.5rem',
        flex: 1,
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '1.5rem',
    },
    sectionTitle: {
        fontSize: '0.85rem',
        fontWeight: '900',
        color: 'white',
        letterSpacing: '0.1em',
        margin: 0,
    },
    broadcastSection: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
    },
    broadcastForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    broadcastInput: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '12px',
        color: 'white',
        fontSize: '0.9rem',
        minHeight: '120px',
        outline: 'none',
        resize: 'none',
    },
    broadcastBtn: {
        background: 'var(--accent-yellow)',
        color: 'black',
        border: 'none',
        borderRadius: '10px',
        padding: '12px',
        fontWeight: '900',
        fontSize: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(250, 204, 21, 0.2)',
    },
    historyList: {
        marginTop: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    historyLabel: {
        fontSize: '0.65rem',
        fontWeight: '900',
        color: 'var(--text-muted)',
        letterSpacing: '0.1em',
    },
    historyItem: {
        padding: '10px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '8px',
        borderLeft: '2px solid var(--accent-yellow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    historyContent: {
        fontSize: '0.8rem',
        color: 'rgba(255,255,255,0.8)',
    },
    historyTime: {
        fontSize: '0.6rem',
        color: 'var(--text-muted)',
        fontWeight: '700',
    },
    supportSection: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '500px',
    },
    supportShell: {
        display: 'grid',
        gridTemplateColumns: '250px 1fr',
        gap: '1.5rem',
        flex: 1,
        overflow: 'hidden',
    },
    agentList: {
        borderRight: '1px solid var(--glass-border)',
        paddingRight: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        overflowY: 'auto',
    },
    agentItem: {
        padding: '12px',
        borderRadius: '12px',
        border: '1px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'left',
        width: '100%',
    },
    agentAvatar: {
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: 'rgba(59, 130, 246, 0.2)',
        color: 'var(--accent-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '900',
        fontSize: '0.9rem',
    },
    agentMeta: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    agentIdName: {
        fontSize: '0.85rem',
        fontWeight: '800',
        color: 'white',
    },
    agentSub: {
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        fontWeight: '700',
    },
    chatArea: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    chatHeader: {
        padding: '0 0 1rem 0',
        borderBottom: '1px solid var(--glass-border)',
        marginBottom: '1rem',
    },
    chatTitle: {
        fontSize: '0.85rem',
        fontWeight: '900',
        color: 'var(--accent-blue)',
    },
    messages: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto',
        paddingRight: '8px',
    },
    bubble: {
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: '14px',
        border: '1px solid transparent',
        display: 'flex',
    },
    bubbleText: {
        fontSize: '0.85rem',
        color: 'rgba(255,255,255,0.9)',
        lineHeight: '1.5',
    },
    replyForm: {
        marginTop: '1.5rem',
        display: 'flex',
        gap: '10px',
    },
    replyInput: {
        flex: 1,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--glass-border)',
        borderRadius: '10px',
        padding: '10px 14px',
        color: 'white',
        fontSize: '0.85rem',
        outline: 'none',
    },
    replyBtn: {
        background: 'var(--accent-blue)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        width: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
    },
    chatPlaceholder: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        opacity: 0.5,
        textAlign: 'center',
        padding: '20px',
    },
    emptyState: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
        gap: '10px',
        opacity: 0.5,
    },
    emptyText: {
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        opacity: 0.5,
    },
    targetToggle: {
        display: 'flex',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        padding: '4px',
        marginBottom: '1rem',
        border: '1px solid var(--glass-border)',
    },
    toggleBtn: {
        flex: 1,
        padding: '8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-muted)',
        fontSize: '0.65rem',
        fontWeight: '900',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    toggleActive: {
        background: 'rgba(59, 130, 246, 0.15)',
        color: 'var(--accent-blue)',
    },
    searchContainer: {
        marginBottom: '1rem',
        position: 'relative',
    },
    searchInputWrapper: {
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '0 10px',
    },
    searchIcon: {
        color: 'var(--text-muted)',
    },
    targetSearchInput: {
        flex: 1,
        background: 'transparent',
        border: 'none',
        padding: '8px',
        color: 'white',
        fontSize: '0.8rem',
        outline: 'none',
    },
    searchResults: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        background: '#121214',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        marginTop: '4px',
        zIndex: 50,
        maxHeight: '200px',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    },
    searchItem: {
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'background 0.2s',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    searchName: {
        fontSize: '0.8rem',
        fontWeight: '700',
        color: 'white',
    },
    searchId: {
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
    },
    searchEmpty: {
        padding: '15px',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
    },
    selectedTarget: {
        padding: '10px',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    targetInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.9)',
    },
    clearTarget: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-muted)',
        fontSize: '1.2rem',
        cursor: 'pointer',
        lineHeight: 1,
    }
};

export default BroadcastCenter;
