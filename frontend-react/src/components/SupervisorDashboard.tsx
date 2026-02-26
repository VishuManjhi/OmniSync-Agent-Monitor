import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/SocketContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAgents, fetchSessions, fetchQueueStats, updateTicket, forceLogout, createTicket, fetchTickets, fetchAgentTickets } from '../api/agent';
import type { Agent, AgentSession, Ticket } from '../api/types';
import { Search, Plus, Phone, Activity, Clock, Users, Coffee, AlertTriangle, Eye } from 'lucide-react';
import BroadcastBanner from './messaging/BroadcastBanner';

// Modular Components
import { styles } from './dashboard/dashboardStyles';
import { StatCard } from './dashboard/StatCard';
import { AgentCard } from './dashboard/AgentCard';
import { TicketModal } from './dashboard/TicketModal';
import { CreateTicketModal } from './dashboard/CreateTicketModal';
import { deriveAgentStatus } from './dashboard/utils';
import ConfirmationModal from './ui/ConfirmationModal';
import { addToQueue } from '../api/indexedDB';
import { useDebounce } from '../hooks/useDebounce';
import { useNotification } from '../context/NotificationContext';
import BroadcastCenter from './messaging/BroadcastCenter';
import ThemeToggle from './ui/ThemeToggle';
import SupervisorSideNav from './dashboard/supervisor/SupervisorSideNav';
import { styles as agentStyles } from './dashboard/agent/agentDashboardStyles';
import { SupervisorStatusPie, SupervisorTicketsBar } from './dashboard/supervisor/SupervisorCharts';
import AgentTicketsDrawer from './dashboard/supervisor/AgentTicketsDrawer';
import ReportCentre from './dashboard/supervisor/ReportCentre';

const SupervisorDashboard: React.FC = () => {
    const { logout, user } = useAuth();
    const { lastMessage, sendMessage } = useWebSocket();
    const queryClient = useQueryClient();
    const { showNotification } = useNotification();

    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [selectedAgentDrawer, setSelectedAgentDrawer] = useState<Agent | null>(null);
    const [agentTicketsPage, setAgentTicketsPage] = useState(1);
    const [showCreateTicket, setShowCreateTicket] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [view, setView] = useState<'MONITOR' | 'AGENTS' | 'REPORTS' | 'ACTIVITY' | 'WORKSTATION' | 'MESSAGING'>('MONITOR');

    const [activityFilter, setActivityFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [confirmLogoutAgent, setConfirmLogoutAgent] = useState<string | null>(null);

    // Queries
    const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
        queryKey: ['agents'],
        queryFn: fetchAgents,
        enabled: !!user?.id
    });

    const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
        queryKey: ['sessions'],
        queryFn: fetchSessions,
        enabled: !!user?.id
    });

    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ['queue-stats'],
        queryFn: fetchQueueStats,
        enabled: !!user?.id,
        refetchInterval: 10000 // Refresh every 10s
    });

    const { data: activityData, isLoading: isLoadingActivity } = useQuery({
        queryKey: ['all-tickets', page, debouncedSearchTerm, activityFilter],
        queryFn: () => fetchTickets(page, 10, debouncedSearchTerm, activityFilter),
        enabled: !!user?.id
    });

    const { data: agentTicketsData, isLoading: isLoadingAgentTickets } = useQuery({
        queryKey: ['agent-tickets', selectedAgentDrawer?.agentId, agentTicketsPage],
        queryFn: () => fetchAgentTickets(selectedAgentDrawer!.agentId, agentTicketsPage, 5, '', 'ALL'),
        enabled: !!selectedAgentDrawer?.agentId
    });

    const activity = activityData?.tickets || [];
    const totalPages = activityData?.pages || 1;

    const loading = isLoadingAgents || isLoadingSessions || isLoadingStats || isLoadingActivity;

    // Mutations
    const updateTicketMutation = useMutation({
        mutationFn: ({ ticketId, updates }: { ticketId: string, updates: Partial<Ticket> }) => updateTicket(ticketId, updates),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['all-tickets'] });
            sendMessage({
                type: 'TICKET_UPDATED',
                ticketId: variables.ticketId,
                updates: variables.updates,
                agentId: selectedTicket?.agentId
            });
            showNotification(`Ticket ${variables.ticketId} updated successfully`, 'success', 'TRANSMISSION UPDATED');
            setSelectedTicket(null);
        },
        onError: (err: any) => {
            showNotification(err.message || 'Failed to update ticket', 'error', 'SYSTEM ERROR');
        }
    });

    const forceLogoutMutation = useMutation({
        mutationFn: forceLogout,
        onSuccess: (_, agentId) => {
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            showNotification(`Agent ${agentId} has been terminated from the session.`, 'success', 'ACCESS REVOKED');
        },
        onError: (err: any) => {
            showNotification(err.message || 'Failed to logout agent', 'error', 'SYSTEM ERROR');
        }
    });

    const createTicketMutation = useMutation({
        mutationFn: createTicket,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['all-tickets'] });
            sendMessage({ type: 'TICKET_CREATED', ticket: variables, agentId: variables.agentId });
            showNotification(`Ticket created and assigned to ${variables.agentId || 'Queue'}`, 'success', 'TRANSMISSION CREATED');
            setShowCreateTicket(false);
        },
        onError: (err: any) => {
            showNotification(err.message || 'Failed to create ticket', 'error', 'SYSTEM ERROR');
        }
    });

    // WebSocket Handling
    useEffect(() => {
        if (lastMessage) {
            const data = lastMessage; // SocketContext already provides the object
            if (data.type === 'AGENT_STATUS_CHANGE' || data.type === 'FORCE_LOGOUT') {
                queryClient.invalidateQueries({ queryKey: ['sessions'] });
            }
            if (data.type === 'TICKET_UPDATED' || data.type === 'TICKET_CREATED') {
                queryClient.invalidateQueries({ queryKey: ['all-tickets'] });
            }
            if (data.type === 'AGENT_STATUS_CHANGE' || data.type === 'TICKET_CREATED') {
                queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
            }
        }
    }, [lastMessage, queryClient]);

    // Reset page to 1 when search term or filter changes
    useEffect(() => {
        setPage(1);
    }, [debouncedSearchTerm, activityFilter]);

    useEffect(() => {
        setAgentTicketsPage(1);
    }, [selectedAgentDrawer?.agentId]);

    const handleForceLogout = (agentId: string) => {
        setConfirmLogoutAgent(agentId);
    };

    const executeForceLogout = async () => {
        const agentId = confirmLogoutAgent;
        if (!agentId) return;

        setConfirmLogoutAgent(null);
        if (!navigator.onLine) {
            try {
                await addToQueue({ type: 'FORCE_LOGOUT', payload: { agentId } });
                showNotification(`Offline: Force logout for ${agentId} queued for synchronization.`, 'warning', 'NETWORK OFFLINE');
                return;
            } catch (err) {
                console.error('Failed to queue offline action:', err);
            }
        }

        forceLogoutMutation.mutate(agentId);
        sendMessage({ type: 'FORCE_LOGOUT', agentId });
    };

    // Derived Statistics
    const currentAHT = stats?.avgHandleTime ? `${Math.floor(stats.avgHandleTime / 60)}:${(stats.avgHandleTime % 60).toString().padStart(2, '0')}` : '0:00';

    const wsOnBreakCount = sessions.filter(s => !s.clockOutTime && s.breaks?.some(b => !b.breakOut)).length;
    const wsOnCallCount = sessions.filter(s => !s.clockOutTime && s.onCall).length;
    const wsActiveCount = sessions.filter(s => !s.clockOutTime).length - wsOnBreakCount - wsOnCallCount;
    const wsOfflineCount = agents.length - sessions.filter(s => !s.clockOutTime).length;

    // Use global stats from backend for ticket analytics, fallback to 0
    const wsResolvedCount = stats?.resolvedCount ?? 0;
    const wsRejectedCount = stats?.rejectedCount ?? 0;
    const wsPendingCount = stats?.pendingCount ?? 0; // Unsolved/Pending
    const wsApprovalCount = stats?.approvalCount ?? 0; // Awaiting Approval
    const wsResolutionRate = stats?.slaPercent ?? 0;
    const recentlyRaisedUnresolved = [...activity]
        .filter(t => t.status !== 'RESOLVED' && t.status !== 'REJECTED')
        .sort((a, b) => b.issueDateTime - a.issueDateTime)
        .slice(0, 10);
    const agentTickets = agentTicketsData?.tickets || [];
    const agentTicketsPages = agentTicketsData?.pages || 1;
    const selectedAgentSession: AgentSession | undefined = selectedAgentDrawer
        ? sessions.find(s => s.agentId === selectedAgentDrawer.agentId)
        : undefined;

    const wsKpis = [
        { label: 'Total Agents', value: agents.length, icon: <Users size={20} />, color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
        { label: 'Active Now', value: wsActiveCount, icon: <Activity size={20} />, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
        { label: 'On Break', value: wsOnBreakCount, icon: <Coffee size={20} />, color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
        { label: 'Awaiting Action', value: wsApprovalCount, icon: <AlertTriangle size={20} />, color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
        { label: 'AHT', value: currentAHT, icon: <Clock size={20} />, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    ];

    if (loading && !stats) {
        return <div style={{ color: 'white', padding: '2rem' }}>LOADING BOOT SEQUENCE...</div>;
    }

    const viewTitleMap: Record<'MONITOR' | 'AGENTS' | 'REPORTS' | 'ACTIVITY' | 'WORKSTATION' | 'MESSAGING', string> = {
        MONITOR: 'Dashboard',
        AGENTS: 'Agents',
        REPORTS: 'Report Centre',
        ACTIVITY: 'Activity Log',
        WORKSTATION: 'Workstation',
        MESSAGING: 'Messaging'
    };

    return (
        <div style={agentStyles.appLayout}>
            <SupervisorSideNav
                activeView={view}
                setActiveView={setView}
                supervisorId={user?.id}
                logout={logout}
            />

            <main style={agentStyles.mainContainer}>
                <header style={agentStyles.topHeader}>
                    <div style={agentStyles.headerTitle}>
                        <h1 style={agentStyles.viewTitle}>{viewTitleMap[view]}</h1>
                        <span style={agentStyles.breadcrumb}>RestroBoard / Supervisor / Control Room</span>
                    </div>
                    <div style={styles.statsRow}>
                        <StatCard
                            icon={<Users size={20} color="var(--accent-yellow)" />}
                            label="Staff"
                            value={stats?.activeAgents || 0}
                        />
                        <StatCard
                            icon={<Phone size={20} color="var(--accent-blue)" />}
                            label="Queue"
                            value={stats?.waitingCalls || 0}
                        />
                        <StatCard
                            icon={<Activity size={20} color="#10b981" />}
                            label="SLA"
                            value={`${stats?.slaPercent || 0}%`}
                        />
                        <StatCard
                            icon={<Clock size={20} color="var(--accent-yellow)" />}
                            label="AHT"
                            value={currentAHT}
                        />
                    </div>
                </header>

                <BroadcastBanner />

                <div style={agentStyles.viewContent}>
                    <div style={styles.main}>
                {view !== 'REPORTS' && view !== 'MESSAGING' && (
                <div style={styles.controlBar}>
                    <div style={styles.searchBox}>
                        <Search size={18} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="SEARCH AGENTS OR TICKETS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={styles.searchInput}
                        />
                    </div>

                    <div style={styles.actions}>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={styles.filterSelect}
                        >
                            <option value="ALL">ALL STATUS</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="ON_CALL">ON CALL</option>
                            <option value="ON_BREAK">BREAK</option>
                            <option value="OFFLINE">OFFLINE</option>
                        </select>
                        <button style={styles.createBtn} onClick={() => setShowCreateTicket(true)}>
                            <Plus size={18} /> New Ticket
                        </button>
                    </div>
                </div>
                )}

                {view === 'MONITOR' ? (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <section className="glass-card" style={{ ...styles.sectionCard, marginBottom: '0' }}>
                                <div style={styles.sectionHeader}>
                                    <div style={styles.sectionIndicator} />
                                    <h2 style={styles.sectionTitle}>Agent Status Distribution</h2>
                                </div>
                                <SupervisorStatusPie
                                    onCall={wsOnCallCount}
                                    onBreak={wsOnBreakCount}
                                    offline={wsOfflineCount}
                                />
                            </section>

                            <section className="glass-card" style={{ ...styles.sectionCard, marginBottom: '0' }}>
                                <div style={styles.sectionHeader}>
                                    <div style={styles.sectionIndicator} />
                                    <h2 style={styles.sectionTitle}>Tickets Raised vs Resolved</h2>
                                </div>
                                <SupervisorTicketsBar
                                    raised={stats?.totalCount || 0}
                                    resolved={wsResolvedCount}
                                />
                            </section>
                        </div>

                        <div className="glass-card" style={styles.recentTicketsSection}>
                            <div style={styles.sectionHeader}>
                                <div style={styles.sectionIndicator} />
                                <h2 style={styles.sectionTitle}>Recent Unresolved / Approval Tickets</h2>
                            </div>

                            <div style={styles.scrollContainer}>
                                {recentlyRaisedUnresolved.map(ticket => (
                                    <div key={ticket.ticketId} style={styles.ticketDetailCard} onClick={() => setSelectedTicket(ticket)}>
                                        <div style={styles.ticketCardHeader}>
                                            <span style={styles.ticketIdText}>{ticket.displayId || `#${ticket.ticketId.substring(0, 8).toUpperCase()}`}</span>
                                            <span style={{
                                                ...styles.statusBadge,
                                                background: 'rgba(168, 85, 247, 0.2)',
                                                color: '#a855f7',
                                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                                padding: '4px 12px',
                                                borderRadius: '8px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800'
                                            }}>
                                                {ticket.status}
                                            </span>
                                        </div>

                                        <div style={styles.ticketCardRow}>
                                            <span style={styles.ticketRowLabel}>Agent</span>
                                            <span style={styles.ticketRowValue}>{ticket.agentId}</span>
                                        </div>
                                        <div style={styles.ticketCardRow}>
                                            <span style={styles.ticketRowLabel}>Issue</span>
                                            <span style={styles.ticketRowValue}>{ticket.issueType}</span>
                                        </div>

                                        <div style={styles.descriptionBox}>
                                            {ticket.description}
                                        </div>

                                        <div style={styles.ticketCardFooter}>
                                            <span style={styles.raisedAt}>
                                                Raised at {new Date(ticket.issueDateTime).toLocaleString()}
                                            </span>
                                        </div>

                                        <div style={styles.ticketActions}>
                                            {(ticket.status === 'RESOLUTION_REQUESTED' && ticket.assignedBy === 'SUPERVISOR') && (
                                                <>
                                                    <button
                                                        style={styles.approveBtn}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}
                                                    >
                                                        APPROVE
                                                    </button>
                                                    <button
                                                        style={styles.rejectCardBtn}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}
                                                    >
                                                        REJECT
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {recentlyRaisedUnresolved.length === 0 && (
                                    <div style={styles.emptyText}>NO UNRESOLVED TICKETS AVAILABLE</div>
                                )}
                            </div>
                        </div>
                    </>
                ) : view === 'AGENTS' ? (
                    <div className="glass-card" style={{ ...styles.sectionCard }}>
                        <div style={styles.sectionHeader}>
                            <div style={styles.sectionIndicator} />
                            <h2 style={styles.sectionTitle}>All Agents</h2>
                        </div>
                        <div style={styles.gridWrapper}>
                            <div style={styles.grid}>
                                {agents
                                    .filter(a => {
                                        const session = sessions.find(s => s.agentId === a.agentId);
                                        const status = deriveAgentStatus(session);
                                        const search = debouncedSearchTerm.toUpperCase();
                                        const matchesSearch = a.name.toUpperCase().includes(search) || a.agentId.toUpperCase().includes(search);
                                        const matchesFilter = statusFilter === 'ALL' || status === statusFilter;
                                        return matchesSearch && matchesFilter;
                                    })
                                    .map((agent, idx) => (
                                        <AgentCard
                                            key={agent.agentId}
                                            agent={agent}
                                            cardIndex={idx}
                                            session={sessions.find(s => s.agentId === agent.agentId)}
                                            onForceLogout={handleForceLogout}
                                            onClick={() => setSelectedAgentDrawer(agent)}
                                        />
                                    ))}
                            </div>
                        </div>
                    </div>
                ) : view === 'REPORTS' ? (
                    <ReportCentre agents={agents} sessions={sessions} />
                ) : view === 'ACTIVITY' ? (
                    <div className="glass-card" style={styles.activityLog}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={styles.sectionTitle}>Recent Activity</h3>
                            <select
                                value={activityFilter}
                                onChange={(e) => setActivityFilter(e.target.value)}
                                style={styles.filterSelect}
                            >
                                <option value="ALL">ALL TICKETS</option>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="RESOLVED">RESOLVED</option>
                                <option value="PRIORITY">PRIORITY {'>'}24h)</option>
                            </select>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Ticket ID</th>
                                        <th style={styles.th}>Agent</th>
                                        <th style={styles.th}>Case Type</th>
                                        <th style={styles.th}>Description</th>
                                        <th style={styles.th}>Time</th>
                                        <th style={styles.th}>Status</th>
                                        <th style={styles.th}>Action</th>
                                    </tr>
                                </thead>
                                <tbody style={{ opacity: isLoadingActivity ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                                    {activity
                                        .map(ticket => {
                                            const agent = agents.find(a => a.agentId === ticket.agentId);
                                            const isPriority = (Date.now() - ticket.issueDateTime) > 86400000 && ticket.status !== 'RESOLVED' && ticket.status !== 'REJECTED';

                                            return (
                                                <tr key={ticket.ticketId} style={styles.tr} onClick={() => setSelectedTicket(ticket)}>
                                                    <td style={{ ...styles.td, fontSize: '0.7rem', color: isPriority ? '#ef4444' : 'var(--accent-yellow)', fontWeight: '700' }}>
                                                        {ticket.displayId || ticket.ticketId.substring(0, 8).toUpperCase()}
                                                        {isPriority && <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: '800' }}>PRIORITY</div>}
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontWeight: '700' }}>{agent?.name || 'Unknown'}</span>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{ticket.agentId}</span>
                                                        </div>
                                                    </td>
                                                    <td style={styles.td}>{ticket.issueType}</td>
                                                    <td style={{ ...styles.td, maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {ticket.description}
                                                    </td>
                                                    <td style={styles.td}>{new Date(ticket.issueDateTime).toLocaleTimeString()}</td>
                                                    <td style={styles.td}>
                                                        <span style={{
                                                            ...styles.statusBadge,
                                                            borderColor: ticket.status === 'RESOLVED' ? '#10b981' : isPriority ? '#ef4444' : 'var(--accent-yellow)',
                                                            color: ticket.status === 'RESOLVED' ? '#10b981' : isPriority ? '#ef4444' : 'var(--accent-yellow)',
                                                        }}>
                                                            {ticket.status}
                                                        </span>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <button onClick={() => setSelectedTicket(ticket)} style={styles.iconBtn}>
                                                            <Eye size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1rem', gap: '1rem' }}>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                style={{ ...styles.createBtn, opacity: page === 1 ? 0.5 : 1, padding: '0.5rem 1rem' }}
                            >
                                Previous
                            </button>
                            <span style={{ color: 'var(--text-light)', fontWeight: '600', fontSize: '0.9rem' }}>Page {page} of {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                style={{ ...styles.createBtn, opacity: page === totalPages ? 0.5 : 1, padding: '0.5rem 1rem' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                ) : view === 'MESSAGING' ? (
                    <BroadcastCenter agents={agents} />
                ) : (
                    <div style={styles.workstationShell}>

                        {/* ── KPI Strip ── */}
                        <div style={styles.kpiStrip}>
                            {wsKpis.map((k, i) => (
                                <div key={i} style={{ ...styles.kpiCard, borderColor: k.color + '55', background: k.bg }}>
                                    <div style={{ ...styles.kpiIcon, color: k.color }}>{k.icon}</div>
                                    <div style={styles.kpiBody}>
                                        <span style={styles.kpiLabel}>{k.label}</span>
                                        <span style={{ ...styles.kpiValue, color: k.color }}>{k.value}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Bottom 2 cols ── */}
                        <div style={styles.wsBotRow}>
                            {/* Agent Status Breakdown */}
                            <div className="glass-card" style={styles.wsPanel}>
                                <div style={styles.wsPanelHeader}>
                                    <div style={{ ...styles.sectionIndicator, background: '#34d399' }} />
                                    <h3 style={styles.wsPanelTitle}>Agent Status Breakdown</h3>
                                </div>
                                {[
                                    { label: 'Active', count: wsActiveCount, total: agents.length, color: '#34d399' },
                                    { label: 'On Call', count: wsOnCallCount, total: agents.length, color: '#60a5fa' },
                                    { label: 'On Break', count: wsOnBreakCount, total: agents.length, color: '#fb923c' },
                                    { label: 'Offline', count: wsOfflineCount, total: agents.length, color: 'var(--text-muted)' },
                                ].map(row => (
                                    <div key={row.label} style={styles.breakdownRow}>
                                        <div style={styles.breakdownMeta}>
                                            <span style={{ ...styles.breakdownDot, background: row.color }} />
                                            <span style={styles.breakdownLabel}>{row.label}</span>
                                            <span style={{ ...styles.breakdownCount, color: row.color }}>{row.count}</span>
                                        </div>
                                        <div style={styles.barTrack}>
                                            <div style={{
                                                ...styles.barFill,
                                                width: `${row.total > 0 ? (row.count / row.total) * 100 : 0}%`,
                                                background: row.color,
                                                boxShadow: `0 0 8px ${row.color}88`,
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Ticket Analytics */}
                            <div className="glass-card" style={styles.wsPanel}>
                                <div style={styles.wsPanelHeader}>
                                    <div style={{ ...styles.sectionIndicator, background: '#a78bfa' }} />
                                    <h3 style={styles.wsPanelTitle}>Ticket Analytics</h3>
                                </div>
                                <div style={styles.ticketStatGrid}>
                                    {[
                                        { label: 'Total Tickets', count: stats?.totalCount || 0, color: '#facc15' },
                                        { label: 'Total Resolved', count: wsResolvedCount, color: '#34d399' },
                                        { label: 'Pending (Unsolved)', count: wsPendingCount, color: '#fb923c' },
                                        { label: 'Total Rejected', count: wsRejectedCount, color: '#ef4444' },
                                        { label: 'Awaiting Approval', count: wsApprovalCount, color: '#60a5fa' },
                                        { label: 'Res. Rate', count: `${wsResolutionRate}%`, color: '#a78bfa' },
                                    ].map(s => (
                                        <div key={s.label} style={styles.ticketStatItem}>
                                            <span style={{ ...styles.ticketStatNum, color: s.color }}>{s.count}</span>
                                            <span style={styles.ticketStatLabel}>{s.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                    </div>
                </div>
            </main>

            {selectedTicket && (
                <TicketModal
                    ticket={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    onUpdate={(updates: Partial<Ticket>) => {
                        updateTicketMutation.mutate({ ticketId: selectedTicket.ticketId, updates });
                    }}
                    onReject={(reason: string) => {
                        const updates = selectedTicket.assignedBy === 'SUPERVISOR'
                            ? { status: 'IN_PROGRESS' as const, rejectionReason: reason }
                            : { status: 'REJECTED' as const, rejectionReason: reason, rejectedAt: Date.now() };
                        updateTicketMutation.mutate({ ticketId: selectedTicket.ticketId, updates });
                    }}
                    isLoading={updateTicketMutation.isPending}
                />
            )}

            {showCreateTicket && (
                <CreateTicketModal
                    agents={agents}
                    onClose={() => setShowCreateTicket(false)}
                    onSubmit={(ticketData) => {
                        const newTicket: Partial<Ticket> = {
                            ...ticketData,
                            ticketId: crypto.randomUUID(),
                            displayId: `${ticketData.issueType}-${ticketData.agentId || 'QUEUE'}-${Math.floor(100 + Math.random() * 899)}`.toUpperCase(),
                            issueDateTime: Date.now(),
                            status: (ticketData.agentId ? 'ASSIGNED' : 'OPEN') as Ticket['status'],
                            assignedBy: ticketData.agentId ? 'SUPERVISOR' : 'SYSTEM',
                            createdBy: user?.id,
                            attachments: []
                        };
                        createTicketMutation.mutate(newTicket);
                    }}
                    isLoading={createTicketMutation.isPending}
                />
            )}

            <AgentTicketsDrawer
                open={!!selectedAgentDrawer}
                agent={selectedAgentDrawer}
                session={selectedAgentSession}
                tickets={agentTickets}
                page={agentTicketsPage}
                totalPages={agentTicketsPages}
                isLoading={isLoadingAgentTickets}
                onClose={() => setSelectedAgentDrawer(null)}
                onPrev={() => setAgentTicketsPage(p => Math.max(1, p - 1))}
                onNext={() => setAgentTicketsPage(p => Math.min(agentTicketsPages, p + 1))}
                onTicketClick={(ticket) => setSelectedTicket(ticket)}
            />

            <ConfirmationModal
                isOpen={!!confirmLogoutAgent}
                title="REVOKE SESSION ACCESS"
                message={`Are you sure you want to forcibly terminate the session for agent ${confirmLogoutAgent}? This action will immediately logout the agent.`}
                confirmText="TERMINATE SESSION"
                cancelText="CANCEL"
                type="danger"
                onConfirm={executeForceLogout}
                onCancel={() => setConfirmLogoutAgent(null)}
            />

            <ThemeToggle />
        </div>
    );
};

export default SupervisorDashboard;
