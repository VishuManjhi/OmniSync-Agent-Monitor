import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/SocketContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    saveAgentSession,
    fetchCurrentSession,
    createTicket,
    fetchAgentTickets,
    updateTicket,
    fetchAgent
} from '../api/agent';
import type { Ticket, AgentSession } from '../api/types';
import {
    Clock,
    Play,
    Square,
    Coffee,
    Phone,
    History,
    Send,
    FileText,
    LogOut,
    CheckCircle,
    AlertCircle,
    Plus
} from 'lucide-react';

const AgentDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { lastMessage, sendMessage } = useWebSocket();
    const queryClient = useQueryClient();

    const [breakTime, setBreakTime] = useState(0); // seconds
    const [shiftTime, setShiftTime] = useState(0); // seconds

    // Form state
    const [issueType, setIssueType] = useState('');
    const [description, setDescription] = useState('');
    const [callDuration, setCallDuration] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);

    // Queries
    const { data: agent, isLoading: isLoadingAgent } = useQuery({
        queryKey: ['agent', user?.id],
        queryFn: () => fetchAgent(user!.id),
        enabled: !!user?.id
    });

    const { data: session, isLoading: isLoadingSession } = useQuery({
        queryKey: ['session', user?.id],
        queryFn: () => fetchCurrentSession(user!.id).catch(() => null),
        enabled: !!user?.id
    });

    const { data: tickets = [], isLoading: isLoadingTickets } = useQuery({
        queryKey: ['tickets', user?.id],
        queryFn: () => fetchAgentTickets(user!.id),
        enabled: !!user?.id
    });

    const loading = isLoadingAgent || isLoadingSession || isLoadingTickets;

    // Mutations
    const sessionMutation = useMutation({
        mutationFn: saveAgentSession,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['session', user?.id] });
            sendMessage({
                type: 'AGENT_STATUS_CHANGE',
                agentId: user!.id,
                status: deriveStatus(variables as AgentSession).toLowerCase(),
                session: variables
            });
        }
    });

    const ticketMutation = useMutation({
        mutationFn: createTicket,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets', user?.id] });
            // Reset form
            setIssueType('');
            setDescription('');
            setCallDuration('');
            setAttachment(null);
            alert('Ticket submitted successfully');
        }
    });

    const updateTicketMutation = useMutation({
        mutationFn: ({ ticketId, updates }: { ticketId: string, updates: Partial<Ticket> }) =>
            updateTicket(ticketId, updates),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tickets', user?.id] });
            try {
                sendMessage({
                    type: 'TICKET_UPDATED',
                    ticketId: variables.ticketId,
                    updates: variables.updates,
                    agentId: user?.id
                });
            } catch (err) {
                console.warn('Failed to send ticket updated websocket message', err);
            }
        }
    });

    // Broadcast initial status on mount/load
    useEffect(() => {
        if (!loading && user?.id) {
            sendMessage({
                type: 'AGENT_STATUS',
                agentId: user.id,
                status: deriveStatus(session || null).toLowerCase(),
                session: session || null
            });
        }
    }, [loading, user?.id]);

    // Timers logic
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;

        if (session && !session.clockOutTime) {
            interval = setInterval(() => {
                const now = Date.now();

                // Shift timer
                setShiftTime(Math.floor((now - session.clockInTime) / 1000));

                // Break timer
                const activeBreak = session.breaks?.find(b => !b.breakOut);
                if (activeBreak) {
                    setBreakTime(Math.floor((now - activeBreak.breakIn) / 1000));
                } else {
                    setBreakTime(0);
                }
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [session]);

    // Session Monitoring Fallback: If we should be clocked in but the session 
    // is missing from the backend (usually due to a missed force logout), logout.
    useEffect(() => {
        if (!isLoadingSession && user?.role === 'agent' && !session) {
            // Check if we were previously clocked in (meaning we were expecting a session)
            // Or just generally, if a clocked-in agent has no active session, they should be logged out.
            // For now, any agent on this dashboard with no active session is considered force-logged out.
            console.log('[Agent] No active session found. Force logging out...');
            logout();
        }
    }, [session, isLoadingSession, user, logout]);
    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type === 'FORCE_LOGOUT' && lastMessage.agentId === user?.id) {
            alert('You were force logged out by supervisor');
            logout();
        }

        if ((lastMessage.type === 'TICKET_CREATED' || lastMessage.type === 'TICKET_UPDATED') && lastMessage.agentId === user?.id) {
            queryClient.invalidateQueries({ queryKey: ['tickets', user?.id] });
        }
    }, [lastMessage, user, logout, queryClient]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const deriveStatus = (sess: AgentSession | null) => {
        if (!sess || sess.clockOutTime) return 'OFFLINE';
        const lastBreak = sess.breaks?.at(-1);
        if (lastBreak && !lastBreak.breakOut) return 'ON_BREAK';
        if (sess.onCall) return 'ON_CALL';
        return 'ACTIVE';
    };

    const handleClockIn = async () => {
        if (!user || (session && !session.clockOutTime)) return;
        const newSession: Partial<AgentSession> = {
            sessionID: crypto.randomUUID(),
            agentId: user.id,
            clockInTime: Date.now(),
            clockOutTime: null,
            breaks: [],
            onCall: false
        };
        sessionMutation.mutate(newSession);
    };

    const handleClockOut = async () => {
        if (!session || !user) return;
        const updated = { ...session, clockOutTime: Date.now() };
        sessionMutation.mutate(updated);
    };

    const handleBreakToggle = async () => {
        if (!session || !user) return;
        const status = deriveStatus(session);
        const updated = { ...session, breaks: [...(session.breaks || [])] };

        if (status === 'ON_BREAK') {
            const activeBreak = updated.breaks.find(b => !b.breakOut);
            if (activeBreak) activeBreak.breakOut = Date.now();
        } else {
            updated.breaks.push({ breakIn: Date.now(), breakOut: null });
        }

        sessionMutation.mutate(updated);
    };

    const handleOnCallToggle = async () => {
        if (!session || !user) return;
        const updated = { ...session, onCall: !session.onCall };
        sessionMutation.mutate(updated);
    };

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !issueType || !description) return;

        try {
            const ticket: Partial<Ticket> = {
                ticketId: crypto.randomUUID(),
                agentId: user.id,
                issueType,
                description,
                status: 'IN_PROGRESS',
                issueDateTime: Date.now(),
                callDuration: Number(callDuration) || null,
                attachments: []
            };

            if (attachment) {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(attachment);
                });

                ticket.attachments?.push({
                    attachmentId: crypto.randomUUID(),
                    fileName: attachment.name,
                    type: attachment.type,
                    size: attachment.size,
                    content: base64
                });
            }

            ticketMutation.mutate(ticket);

            // Notify via WebSocket
            try {
                sendMessage({ type: 'TICKET_CREATED', ticket, agentId: user?.id });
            } catch (err) {
                console.warn('Failed to send ticket created websocket message', err);
            }
        } catch (err) {
            console.error('Failed to submit ticket', err);
            alert('Submission failed');
        }
    };

    const handleTicketUpdate = async (ticketId: string, status: Ticket['status']) => {
        if (!user || !session) return;

        const local = tickets.find(t => t.ticketId === ticketId);
        const updates: Partial<Ticket> = {};

        if (status === 'IN_PROGRESS') {
            updates.status = 'IN_PROGRESS';
            updates.startedAt = Date.now();
        } else if (status === 'RESOLUTION_REQUESTED') {
            const canResolveDirectly = !local?.createdBy || local?.createdBy === user.id;
            if (canResolveDirectly) {
                updates.status = 'RESOLVED';
                updates.resolvedAt = Date.now();
            } else {
                updates.status = 'RESOLUTION_REQUESTED';
                updates.resolutionRequestedAt = Date.now();
            }
        } else if (status === 'RESOLVED') {
            updates.status = 'RESOLVED';
            updates.resolvedAt = Date.now();
        }

        updateTicketMutation.mutate({ ticketId, updates });
    };

    if (loading) return <div style={styles.loading}>Initializing Workspace...</div>;

    const currentStatus = deriveStatus(session || null);

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div style={styles.logoGroup}>
                    <h1 style={styles.logo}>RestroBoard</h1>
                    <span style={styles.badge}>Agent Terminal</span>
                </div>

                <div style={styles.agentInfo}>
                    <div style={styles.profileInfo}>
                        <span style={styles.idLabel}>{agent?.agentId}</span>
                        <h2 style={styles.name}>{agent?.name}</h2>
                    </div>
                    <div style={{ ...styles.statusBadge, borderColor: getStatusColor(currentStatus) }}>
                        {currentStatus}
                    </div>
                    <button onClick={logout} style={styles.iconBtn} title="Logout">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main style={styles.main}>
                <div style={styles.grid}>
                    {/* Operations Card */}
                    <div className="glass-card" style={styles.card}>
                        <h3 style={styles.cardTitle}>Operations</h3>
                        <div style={styles.actionGrid}>
                            <button
                                onClick={handleClockIn}
                                style={{ ...styles.opBtn, borderColor: currentStatus === 'OFFLINE' ? 'var(--accent-blue)' : 'var(--glass-border)' }}
                                disabled={currentStatus !== 'OFFLINE'}
                            >
                                <Play size={16} /> Clock In
                            </button>
                            <button
                                onClick={handleClockOut}
                                style={styles.opBtn}
                                disabled={currentStatus === 'OFFLINE' || currentStatus === 'ON_BREAK'}
                            >
                                <Square size={16} /> Clock Out
                            </button>
                            <button
                                onClick={handleBreakToggle}
                                style={{ ...styles.opBtn, color: currentStatus === 'ON_BREAK' ? 'var(--accent-yellow)' : 'white' }}
                                disabled={currentStatus === 'OFFLINE'}
                            >
                                <Coffee size={16} /> {currentStatus === 'ON_BREAK' ? 'End Break' : 'Start Break'}
                            </button>
                            <button
                                onClick={handleOnCallToggle}
                                style={{ ...styles.opBtn, color: currentStatus === 'ON_CALL' ? 'var(--accent-blue)' : 'white' }}
                                disabled={currentStatus === 'OFFLINE' || currentStatus === 'ON_BREAK'}
                            >
                                <Phone size={16} /> {currentStatus === 'ON_CALL' ? 'End Call' : 'Start Call'}
                            </button>
                        </div>

                        <div style={styles.sessionStats}>
                            <div style={styles.statBox}>
                                <div style={styles.statHeader}>
                                    <Clock size={14} color="var(--text-muted)" />
                                    <span style={styles.statLabel}>Shift Duration</span>
                                </div>
                                <span style={styles.statVal}>{formatTime(shiftTime)}</span>
                            </div>
                            <div style={styles.statBox}>
                                <div style={styles.statHeader}>
                                    <Coffee size={14} color="var(--accent-yellow)" />
                                    <span style={styles.statLabel}>Break Time</span>
                                </div>
                                <span style={{ ...styles.statVal, color: breakTime > 0 ? 'var(--accent-yellow)' : 'white' }}>
                                    {formatTime(breakTime)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Support Desk Card */}
                    <div className="glass-card" style={{ ...styles.card, gridRow: 'span 2' }}>
                        <h3 style={styles.cardTitle}>Support Desk</h3>
                        <form onSubmit={handleTicketSubmit} style={styles.form}>
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Case Type</label>
                                <select
                                    style={styles.select}
                                    value={issueType}
                                    onChange={(e) => setIssueType(e.target.value)}
                                    required
                                >
                                    <option value="">Select Priority/Tier</option>
                                    <option value="FOH">FOH - Front of House</option>
                                    <option value="BOH">BOH - Back of House</option>
                                    <option value="KIOSK">KIOSK - Terminal</option>
                                    <option value="other">Other - Custom</option>
                                </select>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Case Description</label>
                                <textarea
                                    style={styles.textarea}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Explain the issue..."
                                    required
                                />
                            </div>

                            <div style={styles.formRow}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Call Duration (min)</label>
                                    <input
                                        type="number"
                                        style={styles.input}
                                        value={callDuration}
                                        onChange={(e) => setCallDuration(e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Attachment</label>
                                    <div style={styles.fileInputWrapper}>
                                        <Plus size={16} />
                                        <input
                                            type="file"
                                            style={styles.fileInput}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) setAttachment(file);
                                            }}
                                        />
                                        <span style={styles.fileName}>{attachment ? attachment.name : 'Choose File'}</span>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" style={styles.submitBtn} disabled={ticketMutation.isPending || currentStatus === 'OFFLINE'}>
                                <Send size={16} /> {ticketMutation.isPending ? 'Raising Ticket...' : 'Submit Document'}
                            </button>
                        </form>
                    </div>

                    {/* Ticket History */}
                    <div className="glass-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
                        <h3 style={styles.cardTitle}>Personal Ticket History</h3>
                        <div style={styles.ticketList}>
                            {tickets.length > 0 ? tickets.map(t => (
                                <div key={t.ticketId} style={styles.ticketItem}>
                                    <div style={styles.ticketMain}>
                                        <div style={styles.ticketHeader}>
                                            <span style={styles.ticketId}>#{t.ticketId.substring(0, 4).toUpperCase()}</span>
                                            <span style={styles.ticketType}>{t.issueType}</span>
                                            <div style={{ ...styles.statusTag, borderColor: getTicketStatusColor(t.status), color: getTicketStatusColor(t.status) }}>
                                                {t.status}
                                            </div>
                                        </div>
                                        <p style={styles.ticketDesc}>{t.description}</p>
                                        <div style={styles.ticketFooter}>
                                            <div style={styles.ticketTime}>
                                                <History size={12} /> {new Date(t.issueDateTime).toLocaleTimeString()}
                                            </div>
                                            {t.attachments && t.attachments.length > 0 && (
                                                <div style={styles.ticketMeta}>
                                                    <FileText size={12} /> {t.attachments.length} file(s)
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={styles.ticketActions}>
                                        {t.status === 'ASSIGNED' && (
                                            <button
                                                onClick={() => handleTicketUpdate(t.ticketId, 'IN_PROGRESS')}
                                                style={styles.actionBtn}
                                            >
                                                Start Resolution
                                            </button>
                                        )}
                                        {t.status === 'IN_PROGRESS' && (
                                            <button
                                                onClick={() => handleTicketUpdate(t.ticketId, 'RESOLUTION_REQUESTED')}
                                                style={{ ...styles.actionBtn, borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' }}
                                            >
                                                {!t.createdBy || t.createdBy === user?.id ? 'Resolve' : 'Request Resolution'}
                                            </button>
                                        )}
                                        {t.status === 'RESOLUTION_REQUESTED' && (
                                            <div style={styles.awaitingBadge}>
                                                <AlertCircle size={14} /> Awaiting Approval
                                            </div>
                                        )}
                                        {t.status === 'RESOLVED' && (
                                            <div style={{ ...styles.awaitingBadge, color: '#10b981' }}>
                                                <CheckCircle size={14} /> Resolved
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div style={styles.emptyTickets}>No service tickets synchronized for this profile yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const getTicketStatusColor = (status: string) => {
    switch (status) {
        case 'RESOLVED': return '#10b981';
        case 'RESOLUTION_REQUESTED': return 'var(--accent-yellow)';
        case 'IN_PROGRESS': return 'var(--accent-blue)';
        case 'ASSIGNED': return '#f87171';
        case 'OPEN': return 'var(--text-muted)';
        default: return 'var(--text-muted)';
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'ACTIVE': return '#10b981';
        case 'ON_CALL': return 'var(--accent-blue)';
        case 'ON_BREAK': return 'var(--accent-yellow)';
        default: return 'var(--text-muted)';
    }
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        padding: '1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    loading: {
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent-yellow)',
        fontWeight: '900',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logoGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    logo: {
        fontSize: '1.5rem',
        fontWeight: '900',
        color: 'var(--accent-yellow)',
        textTransform: 'uppercase',
    },
    badge: {
        fontSize: '0.6rem',
        background: 'rgba(250, 204, 21, 0.1)',
        color: 'var(--accent-yellow)',
        padding: '2px 8px',
        borderRadius: '4px',
        fontWeight: '700',
        width: 'fit-content',
    },
    agentInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
    },
    profileInfo: {
        textAlign: 'right',
    },
    idLabel: {
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        fontWeight: '700',
    },
    name: {
        fontSize: '1.1rem',
        fontWeight: '800',
        color: 'white',
    },
    statusBadge: {
        padding: '4px 12px',
        borderRadius: '20px',
        border: '1px solid',
        fontSize: '0.75rem',
        fontWeight: '800',
    },
    iconBtn: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        padding: '4px',
    },
    main: {
        flex: 1,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'minmax(350px, 1fr) 1.5fr',
        gap: '1.5rem',
    },
    card: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
    },
    cardTitle: {
        fontSize: '0.8rem',
        fontWeight: '900',
        color: 'var(--accent-yellow)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
    },
    actionGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
    },
    opBtn: {
        padding: '0.85rem',
        borderRadius: '8px',
        border: '1px solid var(--glass-border)',
        background: 'rgba(255,255,255,0.03)',
        color: 'white',
        fontWeight: '700',
        fontSize: '0.85rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s',
    },
    sessionStats: {
        display: 'flex',
        gap: '1rem',
        marginTop: '0.5rem',
    },
    statBox: {
        flex: 1,
        padding: '1rem',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
    },
    statHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '4px',
    },
    statLabel: {
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    statVal: {
        fontSize: '1.25rem',
        fontWeight: '900',
        fontFamily: 'monospace',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    formRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
    },
    label: {
        fontSize: '0.75rem',
        fontWeight: '700',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
    },
    input: {
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--glass-border)',
        padding: '0.75rem',
        borderRadius: '8px',
        color: 'white',
        outline: 'none',
    },
    textarea: {
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--glass-border)',
        padding: '0.75rem',
        borderRadius: '8px',
        color: 'white',
        outline: 'none',
        minHeight: '100px',
        resize: 'vertical',
    },
    select: {
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--glass-border)',
        padding: '0.75rem',
        borderRadius: '8px',
        color: 'white',
        outline: 'none',
    },
    fileInputWrapper: {
        position: 'relative',
        height: '40px',
        border: '1px dashed var(--glass-border)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        overflow: 'hidden',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
    },
    fileInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0,
        cursor: 'pointer',
    },
    fileName: {
        maxWidth: '120px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    submitBtn: {
        padding: '1rem',
        background: 'var(--accent-yellow)',
        border: 'none',
        borderRadius: '8px',
        color: 'var(--bg-deep)',
        fontWeight: '900',
        textTransform: 'uppercase',
        fontSize: '0.85rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        marginTop: '0.5rem',
    },
    ticketList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    ticketItem: {
        padding: '1.25rem',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1.5rem',
    },
    ticketMain: {
        flex: 1,
    },
    ticketHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px',
    },
    ticketId: {
        fontSize: '0.75rem',
        fontWeight: '900',
        color: 'var(--text-muted)',
        fontFamily: 'monospace',
    },
    ticketType: {
        fontSize: '0.75rem',
        fontWeight: '700',
        color: 'white',
        background: 'rgba(255,255,255,0.05)',
        padding: '2px 8px',
        borderRadius: '4px',
    },
    statusTag: {
        fontSize: '0.65rem',
        fontWeight: '800',
        padding: '2px 8px',
        borderRadius: '4px',
        border: '1px solid',
    },
    ticketDesc: {
        fontSize: '0.9rem',
        color: 'var(--text-secondary)',
        lineHeight: '1.5',
        marginBottom: '12px',
    },
    ticketFooter: {
        display: 'flex',
        gap: '1rem',
    },
    ticketTime: {
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    ticketMeta: {
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    ticketActions: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '150px',
    },
    actionBtn: {
        padding: '8px 12px',
        background: 'transparent',
        border: '1px solid var(--accent-blue)',
        color: 'var(--accent-blue)',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    awaitingBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.7rem',
        fontWeight: '700',
        color: 'var(--text-muted)',
        padding: '8px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '6px',
    },
    emptyTickets: {
        textAlign: 'center',
        padding: '3rem',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        fontStyle: 'italic',
        border: '1px dashed var(--glass-border)',
        borderRadius: '12px',
    }
};

export default AgentDashboard;
