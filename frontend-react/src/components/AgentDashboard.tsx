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
    Plus,
    Search,
    Activity
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useNotification } from '../context/NotificationContext';

const AgentDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { lastMessage, sendMessage } = useWebSocket();
    const queryClient = useQueryClient();
    const { showNotification } = useNotification();

    const [breakTime, setBreakTime] = useState(0); // seconds
    const [shiftTime, setShiftTime] = useState(0); // seconds

    // Form state
    const [issueType, setIssueType] = useState('');
    const [description, setDescription] = useState('');
    const [callDuration, setCallDuration] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const [page, setPage] = useState(1);
    const limit = 5;

    // Reset to page 1 when search changes
    useEffect(() => {
        setPage(1);
    }, [debouncedSearchTerm]);

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

    const { data: ticketsData, isLoading: isLoadingTickets } = useQuery({
        queryKey: ['tickets', user?.id, page, debouncedSearchTerm], // Include search term
        queryFn: () => fetchAgentTickets(user!.id, page, limit, debouncedSearchTerm),
        enabled: !!user?.id
    });

    // Unified ticket data extraction with safety fallbacks
    const tickets = Array.isArray(ticketsData)
        ? ticketsData
        : (ticketsData?.tickets || []);

    const totalPages = ticketsData?.pages || (Array.isArray(ticketsData) ? 1 : 0);
    const stats = ticketsData?.stats || { totalResolved: 0, avgHandleTime: 0 };

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
            showNotification('Ticket submitted successfully', 'success', 'TRANSMISSION SENT');
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
        },
        onError: (err: any) => {
            console.error('Ticket update failed:', err);
            showNotification(err.message || 'FAILED TO UPDATE TICKET', 'error', 'SYSTEM ERROR');
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

    // Session Monitoring Fallback: Use the agent-level forceLoggedOut flag.
    // This ensures that even if the WebSocket message is missed, the agent 
    // will be logged out upon their next data refresh.
    useEffect(() => {
        if (!isLoadingAgent && agent?.forceLoggedOut) {
            console.log('[Agent] Detected force-logged out status on agent profile. Logging out...');
            showNotification('You were force logged out by supervisor', 'warning', 'SESSION TERMINATED');
            logout();
        }
    }, [agent, isLoadingAgent, logout]);
    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type === 'FORCE_LOGOUT' && lastMessage.agentId === user?.id) {
            showNotification('You were force logged out by supervisor', 'warning', 'SESSION TERMINATED');
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
        if (!user) return;
        const status = deriveStatus(session || null);
        if (status === 'OFFLINE') {
            showNotification('YOU ARE ALREADY OFFLINE.', 'info', 'SYSTEM REJECT');
            return;
        }
        if (status === 'ON_BREAK') {
            showNotification('PLEASE END YOUR BREAK BEFORE CLOCKING OUT.', 'warning', 'SYSTEM REJECT');
            return;
        }
        const updated = { ...session!, clockOutTime: Date.now() };
        sessionMutation.mutate(updated);
    };

    const handleBreakToggle = async () => {
        if (!user) return;
        const status = deriveStatus(session || null);
        if (status === 'OFFLINE') {
            showNotification('BREAK PROTOCOL CANNOT BE INITIATED WHILE OFFLINE. PLEASE CLOCK IN.', 'error', 'PROTOCOL ERROR');
            return;
        }
        const updated = { ...session!, breaks: [...(session?.breaks || [])] };

        if (status === 'ON_BREAK') {
            const activeBreak = updated.breaks.find(b => !b.breakOut);
            if (activeBreak) activeBreak.breakOut = Date.now();
        } else {
            updated.breaks.push({ breakIn: Date.now(), breakOut: null });
        }

        sessionMutation.mutate(updated);
    };

    const handleOnCallToggle = async () => {
        if (!user) return;
        const status = deriveStatus(session || null);
        if (status === 'OFFLINE') {
            showNotification('CALL PROTOCOL CANNOT BE INITIATED WHILE OFFLINE. PLEASE CLOCK IN.', 'error', 'PROTOCOL ERROR');
            return;
        }
        if (status === 'ON_BREAK') {
            showNotification('CALL PROTOCOL CANNOT BE INITIATED WHILE ON BREAK. PLEASE END BREAK FIRST.', 'warning', 'PROTOCOL ERROR');
            return;
        }
        const updated = { ...session!, onCall: !session!.onCall };
        sessionMutation.mutate(updated);
    };

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !issueType || !description) return;

        const status = deriveStatus(session || null);
        if (status === 'OFFLINE') {
            showNotification('TICKET SUBMISSION BLOCKED. YOU MUST BE CLOCKED IN TO LOG A TRANSMISSION.', 'error', 'SYSTEM ERROR');
            return;
        }

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
            showNotification('Submission failed', 'error', 'SYSTEM ERROR');
        }
    };

    const handleTicketUpdate = async (id: string, status: Ticket['status']) => {
        if (!user) return;

        const currentStatus = deriveStatus(session || null);
        if (currentStatus === 'OFFLINE') {
            showNotification('YOU MUST CLOCK IN BEFORE INTERACTING WITH TICKETS', 'error', 'PROTOCOL ERROR');
            return;
        }

        const local = tickets.find((t: Ticket) => t._id === id);
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

        updateTicketMutation.mutate({ ticketId: id, updates });
    };

    // Derived KPIs from backend stats
    const kpis = [
        { label: 'Cases Resolved', value: stats.totalResolved, icon: <CheckCircle size={20} />, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
        { label: 'Avg Handle Time', value: formatTime(stats.avgHandleTime), icon: <Clock size={20} />, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
        { label: 'Active Shift', value: formatTime(shiftTime), icon: <Play size={20} />, color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
        { label: 'Total Break', value: formatTime(breakTime), icon: <Coffee size={20} />, color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
    ];

    if (loading) return (
        <div style={styles.loading}>
            <span>INITIALIZING TERMINAL...</span>
        </div>
    );

    const currentStatus = deriveStatus(session || null);

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div style={styles.logoGroup}>
                    <h1 style={styles.logo}>RestroBoard</h1>
                    <div style={styles.statusIndicator}>
                        <span style={{ ...styles.statusDot, background: getStatusColor(currentStatus) }} />
                        <span style={styles.badge}>{currentStatus} NODE</span>
                    </div>
                </div>

                <div style={styles.agentInfo}>
                    <div style={styles.profileInfo}>
                        <span style={styles.idLabel}>{agent?.agentId}</span>
                        <h2 style={styles.name}>{agent?.name}</h2>
                    </div>
                    <button onClick={logout} style={styles.exitBtn}>
                        <LogOut size={18} /> Exit
                    </button>
                </div>
            </header>

            <main style={styles.main}>
                {/* ── KPI Strip ── */}
                <div style={styles.kpiStrip} className="kpi-strip">
                    {kpis.map((k, i) => (
                        <div key={i} className="glass-card hover-lift" style={{ ...styles.kpiCard, borderColor: k.color + '44' }}>
                            <div style={{ ...styles.kpiIcon, background: k.bg, color: k.color }}>{k.icon}</div>
                            <div style={styles.kpiContent}>
                                <span style={styles.kpiLabel}>{k.label}</span>
                                <span style={{ ...styles.kpiValue, color: k.color }}>{k.value}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={styles.layoutGrid} className="agent-layout-grid">
                    {/* Left Panel: Operations & Support Desk */}
                    <div style={styles.sidePanel}>
                        <section className="glass-card" style={styles.panelSection}>
                            <h3 style={styles.panelTitle}>
                                <Activity size={16} /> Command Center
                            </h3>
                            <div style={styles.actionGrid}>
                                <button
                                    onClick={handleClockIn}
                                    style={{ ...styles.opBtn, borderColor: currentStatus === 'OFFLINE' ? 'var(--accent-blue)' : 'transparent' }}
                                    disabled={currentStatus !== 'OFFLINE'}
                                    className="hover-glow"
                                >
                                    <Play size={16} /> Clock In
                                </button>
                                <button
                                    onClick={handleClockOut}
                                    style={styles.opBtn}
                                    className="hover-glow"
                                >
                                    <Square size={16} /> Clock Out
                                </button>
                                <button
                                    onClick={handleBreakToggle}
                                    style={{ ...styles.opBtn, color: currentStatus === 'ON_BREAK' ? 'var(--accent-yellow)' : 'white' }}
                                    className="hover-glow"
                                >
                                    <Coffee size={16} /> {currentStatus === 'ON_BREAK' ? 'End Break' : 'Start Break'}
                                </button>
                                <button
                                    onClick={handleOnCallToggle}
                                    style={{ ...styles.opBtn, color: currentStatus === 'ON_CALL' ? 'var(--accent-blue)' : 'white' }}
                                    className="hover-glow"
                                >
                                    <Phone size={16} /> {currentStatus === 'ON_CALL' ? 'End Call' : 'Start Call'}
                                </button>
                            </div>
                        </section>

                        <section className="glass-card" style={styles.panelSection}>
                            <h3 style={styles.panelTitle}>
                                <Plus size={16} /> New Transmission
                            </h3>
                            <form onSubmit={handleTicketSubmit} style={styles.form}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Case Category</label>
                                    <select
                                        style={styles.select}
                                        value={issueType}
                                        onChange={(e) => setIssueType(e.target.value)}
                                        required
                                    >
                                        <option value="">Select Priority</option>
                                        <option value="FOH">FOH - Front of House</option>
                                        <option value="BOH">BOH - Back of House</option>
                                        <option value="KIOSK">KIOSK - Terminal</option>
                                        <option value="other">Other - Custom</option>
                                    </select>
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Log Narrative</label>
                                    <textarea
                                        style={styles.textarea}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe the incident details..."
                                        required
                                    />
                                </div>
                                <div style={styles.formRow}>
                                    <div style={styles.formGroup}>
                                        <label style={styles.label}>Duration (min)</label>
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
                                        <div className="hover-glow" style={styles.fileInputWrapper}>
                                            <FileText size={16} />
                                            <input
                                                type="file"
                                                style={styles.fileInput}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) setAttachment(file);
                                                }}
                                            />
                                            <span style={styles.fileName}>{attachment ? attachment.name : 'UPLD_FILE'}</span>
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" style={styles.submitBtn} disabled={ticketMutation.isPending || currentStatus === 'OFFLINE'}>
                                    <Send size={16} /> {ticketMutation.isPending ? 'TRANSMITTING...' : 'SEND LOG'}
                                </button>
                            </form>
                        </section>
                    </div>

                    <div style={styles.mainPanel}>
                        <section className="glass-card" style={{ ...styles.panelSection, flex: 1 }}>
                            <div style={styles.panelHeader}>
                                <h3 style={styles.panelTitle}>
                                    <History size={16} /> My Tickets
                                </h3>
                                <div style={styles.searchWrapper}>
                                    <Search size={14} color="var(--text-muted)" />
                                    <input
                                        style={styles.searchInput}
                                        placeholder="SEARCH BY ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>

                            <div style={styles.ticketScroll}>
                                {tickets.length > 0 ? (
                                    tickets.map((t: Ticket) => (
                                        <div key={t._id} className="hover-lift" style={styles.ticketItem}>
                                            <div style={styles.ticketContent}>
                                                <div style={styles.ticketHeader}>
                                                    <span style={styles.ticketId}>#{t.ticketId.substring(0, 8).toUpperCase()}</span>
                                                    <span style={styles.ticketType}>{t.issueType}</span>
                                                    <span style={{
                                                        ...styles.statusTag,
                                                        borderColor: getTicketStatusColor(t.status) + '66',
                                                        color: getTicketStatusColor(t.status),
                                                        background: getTicketStatusColor(t.status) + '11'
                                                    }}>
                                                        {t.status}
                                                    </span>
                                                </div>
                                                <p style={styles.ticketDesc}>{t.description}</p>
                                                <div style={styles.ticketFooter}>
                                                    <span style={styles.ticketMeta}><Clock size={12} /> {new Date(t.issueDateTime).toLocaleTimeString()}</span>
                                                    {t.attachments && t.attachments.length > 0 && (
                                                        <span style={styles.ticketMeta}><FileText size={12} /> {t.attachments.length} ATTCH</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={styles.ticketActions}>
                                                {t.status === 'ASSIGNED' && (
                                                    <button
                                                        onClick={() => handleTicketUpdate(t._id, 'IN_PROGRESS')}
                                                        style={styles.actionBtn}
                                                    >
                                                        START
                                                    </button>
                                                )}
                                                {t.status === 'IN_PROGRESS' && (
                                                    <button
                                                        onClick={() => handleTicketUpdate(t._id, 'RESOLUTION_REQUESTED')}
                                                        style={{ ...styles.actionBtn, borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' }}
                                                    >
                                                        RESOLVE
                                                    </button>
                                                )}
                                                {t.status === 'RESOLUTION_REQUESTED' && (
                                                    <div style={{ ...styles.awaitingBadge, color: 'var(--accent-yellow)' }}>
                                                        <Activity size={14} className="spin" /> REQ_SENT
                                                    </div>
                                                )}
                                                {t.status === 'RESOLVED' && (
                                                    <div style={{ ...styles.awaitingBadge, color: '#10b981' }}>
                                                        <CheckCircle size={14} /> DONE
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={styles.emptyState}>
                                        <AlertCircle size={40} color="var(--glass-border)" />
                                        <span>NO SIGNALS DETECTED</span>
                                    </div>
                                )}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div style={styles.pagination}>
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        style={styles.pageBtn}
                                    >
                                        Prev
                                    </button>
                                    <span style={styles.pageInfo}>PAGE {page} OF {totalPages}</span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        style={styles.pageBtn}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </section>
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
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
    },
    loading: {
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent-yellow)',
        fontWeight: '900',
        letterSpacing: '0.3em',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.02)',
        padding: '1rem 1.5rem',
        borderRadius: '16px',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(10px)',
    },
    logoGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    logo: {
        fontSize: '1.6rem',
        fontWeight: '950',
        background: 'linear-gradient(135deg, var(--accent-yellow), #fcd34d)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    statusIndicator: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    statusDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        boxShadow: '0 0 10px currentColor',
    },
    badge: {
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        fontWeight: '800',
        letterSpacing: '0.1em',
    },
    agentInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
    },
    profileInfo: {
        textAlign: 'right',
    },
    idLabel: {
        fontSize: '0.65rem',
        color: 'var(--accent-yellow)',
        fontWeight: '900',
        fontFamily: 'monospace',
    },
    name: {
        fontSize: '1.2rem',
        fontWeight: '800',
        color: 'white',
    },
    exitBtn: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
        padding: '8px 16px',
        borderRadius: '8px',
        fontWeight: '800',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    main: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    kpiStrip: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
    },
    kpiCard: {
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        background: 'rgba(255,255,255,0.03)',
        transition: 'all 0.3s ease',
        borderRadius: '12px',
    },
    kpiIcon: {
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiContent: {
        display: 'flex',
        flexDirection: 'column',
    },
    kpiLabel: {
        fontSize: '0.65rem',
        fontWeight: '800',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    kpiValue: {
        fontSize: '1.2rem',
        fontWeight: '900',
        fontFamily: 'monospace',
    },
    layoutGrid: {
        display: 'grid',
        gridTemplateColumns: '400px 1fr',
        gap: '1.5rem',
        alignItems: 'start',
    },
    sidePanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    mainPanel: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '600px',
    },
    panelSection: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    panelTitle: {
        fontSize: '0.85rem',
        fontWeight: '900',
        color: 'var(--accent-yellow)',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    actionGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
    },
    opBtn: {
        padding: '1rem',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--glass-border)',
        color: 'white',
        fontWeight: '800',
        fontSize: '0.85rem',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    label: {
        fontSize: '0.7rem',
        fontWeight: '900',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        paddingLeft: '4px',
    },
    select: {
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid var(--glass-border)',
        padding: '0.85rem',
        borderRadius: '10px',
        color: 'white',
        fontSize: '0.9rem',
    },
    textarea: {
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid var(--glass-border)',
        padding: '1rem',
        borderRadius: '10px',
        color: 'white',
        minHeight: '120px',
        fontSize: '0.9rem',
        resize: 'none',
    },
    formRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr',
        gap: '1rem',
    },
    input: {
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid var(--glass-border)',
        padding: '0.85rem',
        borderRadius: '10px',
        color: 'white',
    },
    fileInputWrapper: {
        height: '45px',
        border: '1px dashed var(--glass-border)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        position: 'relative',
        cursor: 'pointer',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
    },
    fileInput: {
        position: 'absolute',
        opacity: 0,
        width: '100%',
        height: '100%',
        cursor: 'pointer',
    },
    fileName: {
        fontWeight: '800',
        fontFamily: 'monospace',
    },
    submitBtn: {
        padding: '1.1rem',
        background: 'linear-gradient(135deg, var(--accent-yellow), #fcd34d)',
        border: 'none',
        borderRadius: '12px',
        color: '#1a1b1e',
        fontWeight: '950',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(250, 204, 21, 0.2)',
    },
    panelHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
    },
    searchWrapper: {
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid var(--glass-border)',
        padding: '8px 12px',
        borderRadius: '8px',
        gap: '10px',
    },
    searchInput: {
        background: 'transparent',
        border: 'none',
        color: 'white',
        outline: 'none',
        fontSize: '0.75rem',
        fontWeight: '700',
        width: '180px',
    },
    ticketScroll: {
        flex: 1,
        overflowY: 'auto',
        paddingRight: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    ticketItem: {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.5rem',
        transition: 'all 0.3s ease',
    },
    ticketContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    ticketHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    ticketId: {
        fontSize: '0.8rem',
        fontWeight: '900',
        color: 'var(--accent-yellow)',
        fontFamily: 'monospace',
    },
    ticketType: {
        fontSize: '0.7rem',
        fontWeight: '900',
        color: 'white',
        background: 'rgba(255,255,255,0.05)',
        padding: '2px 10px',
        borderRadius: '6px',
    },
    statusTag: {
        fontSize: '0.65rem',
        fontWeight: '900',
        padding: '2px 10px',
        borderRadius: '100px',
        border: '1px solid',
        textTransform: 'uppercase',
    },
    ticketDesc: {
        fontSize: '0.95rem',
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
    },
    ticketFooter: {
        display: 'flex',
        gap: '1.5rem',
    },
    ticketMeta: {
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: '700',
    },
    ticketActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    actionBtn: {
        padding: '10px 20px',
        borderRadius: '8px',
        background: 'transparent',
        border: '1px solid var(--accent-blue)',
        color: 'var(--accent-blue)',
        fontWeight: '900',
        fontSize: '0.75rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    awaitingBadge: {
        fontSize: '0.75rem',
        fontWeight: '900',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    emptyState: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        color: 'var(--glass-border)',
        fontWeight: '900',
        letterSpacing: '0.2em',
    },
    pagination: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        marginTop: '1rem',
        padding: '1rem',
        borderTop: '1px solid var(--glass-border)',
    },
    pageBtn: {
        padding: '6px 16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--glass-border)',
        borderRadius: '6px',
        color: 'white',
        fontSize: '0.75rem',
        fontWeight: '800',
        cursor: 'pointer',
    },
    pageInfo: {
        fontSize: '0.7rem',
        fontWeight: '900',
        color: 'var(--text-muted)',
        fontFamily: 'monospace',
    },
};

export default AgentDashboard;
