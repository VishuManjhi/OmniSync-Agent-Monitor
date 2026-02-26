import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/SocketContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchCurrentSession,
    createTicket,
    fetchAgentTickets,
    updateTicket,
    fetchAgent,
    fetchAgentAnalytics
} from '../api/agent';
import type { Ticket } from '../api/types';
import {
    CheckCircle,
    Clock,
    Play,
    AlertTriangle,
    Activity,
    MessageSquare
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useNotification } from '../context/NotificationContext';
import BroadcastBanner from './messaging/BroadcastBanner';
import ThemeToggle from './ui/ThemeToggle';
import { useMessaging } from '../context/MessagingContext';

// Modular Components & Hooks
import { useAgentSession } from '../hooks/useAgentSession';
import { styles } from './dashboard/agent/agentDashboardStyles';
import AgentSideNav from './dashboard/agent/AgentSideNav';
import DashboardOverview from './dashboard/agent/DashboardOverview';
import TicketArchive from './dashboard/agent/TicketArchive';
import CommandCentre from './dashboard/agent/CommandCentre';
import AgentProfile from './dashboard/agent/AgentProfile';
import MetricsTab from './dashboard/agent/MetricsTab';

const AgentDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { lastMessage, sendMessage } = useWebSocket();
    const queryClient = useQueryClient();
    const { showNotification } = useNotification();
    const { messages, sendMessage: sendChatMessage } = useMessaging();

    // UI state
    const [activeView, setActiveView] = useState<'DASHBOARD' | 'TICKETS' | 'COMMAND_CENTRE' | 'PROFILE' | 'CHAT' | 'METRICS'>('COMMAND_CENTRE');
    const [chatContent, setChatContent] = useState('');
    const chatScrollRef = React.useRef<HTMLDivElement>(null);

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

    const { data: ticketsData } = useQuery({
        queryKey: ['tickets', user?.id, page, debouncedSearchTerm],
        queryFn: () => fetchAgentTickets(user!.id, page, limit, debouncedSearchTerm),
        enabled: !!user?.id
    });

    const { data: agentAnalytics } = useQuery({
        queryKey: ['agentAnalytics', user?.id],
        queryFn: () => fetchAgentAnalytics(user!.id),
        enabled: !!user?.id && (activeView === 'DASHBOARD' || activeView === 'METRICS'),
        refetchInterval: 30000
    });

    // Custom Hook for Session Management
    const {
        breakTime,
        shiftTime,
        deriveStatus,
        handleClockIn,
        handleClockOut,
        handleBreakToggle,
        handleOnCallToggle,
        isSessionLoading
    } = useAgentSession(user?.id, session);

    const currentStatus = deriveStatus(session || null);

    // Mutations
    const ticketMutation = useMutation({
        mutationFn: createTicket,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets', user?.id] });
            setIssueType('');
            setDescription('');
            setCallDuration('');
            setAttachment(null);
            showNotification('Ticket submitted successfully', 'success', 'TRANSMISSION SENT');
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'FAILED TO SUBMIT TICKET';
            showNotification(message, 'error', 'SYSTEM ERROR');
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
            showNotification(err.message || 'FAILED TO UPDATE TICKET', 'error', 'SYSTEM ERROR');
        }
    });

    // Effects for WebSocket messages
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

    // Force Logout check
    useEffect(() => {
        if (!isLoadingAgent && agent?.forceLoggedOut) {
            showNotification('You were force logged out by supervisor', 'warning', 'SESSION TERMINATED');
            logout();
        }
    }, [agent, isLoadingAgent, logout]);

    // Helpers
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !issueType || !description) return;
        if (currentStatus === 'OFFLINE') return;

        try {
            const ticket: Partial<Ticket> = {
                ticketId: crypto.randomUUID(),
                displayId: `${issueType}-${user.id}-${Math.floor(100 + Math.random() * 899)}`.toUpperCase(),
                agentId: user.id,
                issueType,
                description,
                status: 'IN_PROGRESS',
                issueDateTime: Date.now(),
                startedAt: Date.now(),
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
        } catch (err) {
            showNotification('Failed to process attachment', 'error', 'FILE ERROR');
        }
    };

    const handleTicketUpdate = (ticketId: string, newStatus: string) => {
        updateTicketMutation.mutate({ ticketId, updates: { status: newStatus as any } });
    };

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatContent.trim()) return;
        sendChatMessage(chatContent);
        setChatContent('');
    };

    if (isLoadingAgent || isLoadingSession) {
        return <div style={styles.loading}>INITIALIZING TERMINAL...</div>;
    }

    // Data Extraction
    const tickets = Array.isArray(ticketsData) ? ticketsData : (ticketsData?.tickets || []);
    const totalPages = ticketsData?.pages || (Array.isArray(ticketsData) ? 1 : 0);
    const apiStats = ticketsData?.stats || { totalResolved: 0, avgHandleTime: 0 };

    const filteredTickets = tickets.filter((t: Ticket) => {
        if (activeView === 'COMMAND_CENTRE') return t.status !== 'RESOLVED' && t.status !== 'REJECTED';
        if (activeView === 'TICKETS') return t.status === 'RESOLVED' || t.status === 'REJECTED';
        return true;
    });

    const kpis = [
        { label: 'Resolved Tickets', value: apiStats.totalResolved, icon: <CheckCircle size={20} />, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
        { label: 'Total Rejected', value: agentAnalytics?.overallRatio?.totalRejected || 0, icon: <AlertTriangle size={20} />, color: 'var(--accent-error)', bg: 'rgba(239,68,68,0.1)' },
        { label: 'Avg Handle Time', value: formatTime(apiStats.avgHandleTime), icon: <Clock size={20} />, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
        { label: 'Shift Timer', value: formatTime(shiftTime), icon: <Play size={20} />, color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
    ];

    return (
        <div style={styles.appLayout}>
            <AgentSideNav
                activeView={activeView}
                setActiveView={setActiveView}
                agent={agent}
                logout={logout}
            />

            <main style={styles.mainContainer}>
                <header style={styles.topHeader}>
                    <div style={styles.headerTitle}>
                        <h1 style={styles.viewTitle}>{activeView.replace('_', ' ')}</h1>
                        <span style={styles.breadcrumb}>OmniSync / Agent / Workspace</span>
                    </div>
                </header>

                <BroadcastBanner />

                <div style={styles.viewContent}>
                    {activeView === 'DASHBOARD' && (
                        <DashboardOverview kpis={kpis} agentAnalytics={agentAnalytics} />
                    )}

                    {activeView === 'METRICS' && (
                        <MetricsTab agentId={user?.id || ''} agentAnalytics={agentAnalytics} />
                    )}

                    {activeView === 'TICKETS' && (
                        <TicketArchive
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            filteredTickets={filteredTickets}
                            page={page}
                            setPage={setPage}
                            totalPages={totalPages}
                        />
                    )}

                    {activeView === 'COMMAND_CENTRE' && (
                        <CommandCentre
                            currentStatus={currentStatus}
                            handleClockIn={handleClockIn}
                            handleClockOut={handleClockOut}
                            handleBreakToggle={handleBreakToggle}
                            handleOnCallToggle={handleOnCallToggle}
                            issueType={issueType}
                            setIssueType={setIssueType}
                            description={description}
                            setDescription={setDescription}
                            callDuration={callDuration}
                            setCallDuration={setCallDuration}
                            handleAttachmentChange={setAttachment}
                            attachment={attachment}
                            handleTicketSubmit={handleTicketSubmit}
                            ticketMutationPending={ticketMutation.isPending}
                            filteredTickets={filteredTickets}
                            handleTicketUpdate={handleTicketUpdate}
                            isSessionLoading={isSessionLoading}
                        />
                    )}

                    {activeView === 'PROFILE' && (
                        <AgentProfile agent={agent} logout={logout} />
                    )}

                    {activeView === 'CHAT' && (
                        <div style={{ ...styles.dashboardView, height: 'calc(100vh - 200px)' }} className="fade-in">
                            <div className="glass-card" style={{ ...styles.sectionCard, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={styles.sectionHeader}>
                                    <h3 style={styles.sectionTitle}>Support Messaging</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: '700', color: '#10b981' }}>
                                        <Activity size={14} className="spin" /> CHANNEL ACTIVE
                                    </div>
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '12px' }}>
                                    {messages.length > 0 ? (
                                        messages.map((msg, i) => (
                                            <div key={i} style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: msg.senderId === user?.id ? 'flex-end' : 'flex-start' }}>
                                                <div style={{ padding: '10px 14px', borderRadius: '12px', background: msg.senderId === user?.id ? '#2563eb' : '#f1f5f9', color: msg.senderId === user?.id ? '#fff' : '#1e293b', maxWidth: '80%', fontSize: '0.9rem' }}>
                                                    {msg.content}
                                                </div>
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px', fontWeight: '600' }}>
                                                    {msg.senderId === user?.id ? 'Me' : 'System Agent'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={styles.emptyView}>
                                            <MessageSquare size={48} />
                                            <span>No messages yet. Start a conversation.</span>
                                        </div>
                                    )}
                                    <div ref={chatScrollRef} />
                                </div>

                                <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '12px', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                                    <input
                                        value={chatContent}
                                        onChange={(e) => setChatContent(e.target.value)}
                                        placeholder="Describe your issue..."
                                        style={{ ...styles.lightInput, padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                    />
                                    <button type="submit" style={{ ...styles.primaryBtn, width: '120px' }} disabled={!chatContent.trim()}>
                                        Send
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <ThemeToggle position={{ bottom: '24px', left: 'auto', right: '24px' }} />
        </div>
    );
};

export default AgentDashboard;
