import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/SocketContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAgents, fetchSessions, fetchQueueStats, updateTicket, forceLogout, createTicket, fetchTickets } from '../api/agent';
import type { Agent, Ticket } from '../api/types';
import { Users, Phone, Clock, Activity, LogOut, Search, Eye, Plus, AlertTriangle, Coffee } from 'lucide-react';

// Modular Components
import { styles } from './dashboard/dashboardStyles';
import { StatCard } from './dashboard/StatCard';
import { AgentCard } from './dashboard/AgentCard';
import { TicketModal } from './dashboard/TicketModal';
import { CreateTicketModal } from './dashboard/CreateTicketModal';
import { AgentDetailsModal } from './dashboard/AgentDetailsModal';
import { deriveAgentStatus } from './dashboard/utils';
import ConfirmationModal from './ui/ConfirmationModal';
import { addToQueue } from '../api/indexedDB';
import { useDebounce } from '../hooks/useDebounce';
import { useNotification } from '../context/NotificationContext';

const SupervisorDashboard: React.FC = () => {
    const { logout, user } = useAuth();
    const { lastMessage, sendMessage } = useWebSocket();
    const queryClient = useQueryClient();
    const { showNotification } = useNotification();

    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [showCreateTicket, setShowCreateTicket] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [view, setView] = useState<'MONITOR' | 'ACTIVITY' | 'WORKSTATION'>('MONITOR');
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
        queryKey: ['all-tickets', page],
        queryFn: () => fetchTickets(page, 10),
        enabled: !!user?.id
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
    const wsResolvedCount = activity.filter(t => t.status === 'RESOLVED').length;
    const wsRejectedCount = activity.filter(t => t.status === 'REJECTED').length;
    const wsOpenCount = activity.filter(t => t.status === 'OPEN' || t.status === 'ASSIGNED').length;
    const wsPendingCount = activity.filter(t => t.status === 'RESOLUTION_REQUESTED').length;
    const wsResolutionRate = activity.length > 0 ? Math.round((wsResolvedCount / activity.length) * 100) : 0;

    const wsKpis = [
        { label: 'Total Agents', value: agents.length, icon: <Users size={20} />, color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
        { label: 'Active Now', value: wsActiveCount, icon: <Activity size={20} />, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
        { label: 'On Break', value: wsOnBreakCount, icon: <Coffee size={20} />, color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
        { label: 'Tickets Open', value: wsOpenCount + wsPendingCount, icon: <AlertTriangle size={20} />, color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
        { label: 'AHT', value: currentAHT, icon: <Clock size={20} />, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    ];

    if (loading && !stats) {
        return <div style={{ color: 'white', padding: '2rem' }}>LOADING BOOT SEQUENCE...</div>;
    }

    return (
        <div style={styles.dashboard}>
            {/* Header / Command Info */}
            <header style={styles.header}>
                <div style={styles.logoGroup}>
                    <h1 style={styles.logo}>RestroBoard</h1>
                    <span style={styles.badge}>Live Terminal</span>
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

                <button onClick={logout} style={styles.logoutBtn}>
                    <LogOut size={18} /> Exit
                </button>
            </header>

            <main style={styles.main}>
                <div style={styles.controlBar}>
                    <div style={styles.searchBox}>
                        <Search size={18} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="SEARCH AGENTS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
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

                <div style={styles.viewTabs}>
                    <button
                        style={{ ...styles.viewTab, ...(view === 'MONITOR' ? styles.activeViewTab : {}) }}
                        onClick={() => setView('MONITOR')}
                    >
                        Live Monitor
                    </button>
                    <button
                        style={{ ...styles.viewTab, ...(view === 'ACTIVITY' ? styles.activeViewTab : {}) }}
                        onClick={() => setView('ACTIVITY')}
                    >
                        Activity Log
                    </button>
                    <button
                        style={{ ...styles.viewTab, ...(view === 'WORKSTATION' ? styles.activeViewTab : {}) }}
                        onClick={() => setView('WORKSTATION')}
                    >
                        WorkStation
                    </button>
                </div>

                {view === 'MONITOR' ? (
                    <>
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
                                            onClick={() => setSelectedAgent(agent)}
                                        />
                                    ))
                                }
                            </div>
                        </div>

                        {/* Recent Tickets Section */}
                        <div className="glass-card" style={styles.recentTicketsSection}>
                            <div style={styles.sectionHeader}>
                                <div style={styles.sectionIndicator} />
                                <h2 style={styles.sectionTitle}>Recent Tickets</h2>
                            </div>

                            <div style={styles.scrollContainer}>
                                {activity
                                    .sort((a, b) => b.issueDateTime - a.issueDateTime)
                                    .slice(0, 10)
                                    .map(ticket => (
                                        <div key={ticket.ticketId} style={styles.ticketDetailCard} onClick={() => setSelectedTicket(ticket)}>
                                            <div style={styles.ticketCardHeader}>
                                                <span style={styles.ticketIdText}>#{ticket.ticketId.substring(0, 4).toUpperCase()}</span>
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
                                                {(ticket.status === 'RESOLUTION_REQUESTED' || ticket.status === 'OPEN') && (
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
                                    ))
                                }
                                {activity.length === 0 && (
                                    <div style={styles.emptyText}>NO RECENT TICKETS AVAILABLE</div>
                                )}
                            </div>
                        </div>
                    </>
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
                                <tbody>
                                    {activity
                                        .filter(ticket => {
                                            const agent = agents.find(a => a.agentId === ticket.agentId);
                                            const search = debouncedSearchTerm.toUpperCase();
                                            const matchesSearch = !debouncedSearchTerm ||
                                                ticket.ticketId.toUpperCase().includes(search) ||
                                                ticket.agentId.toUpperCase().includes(search) ||
                                                (agent && agent.name.toUpperCase().includes(search));

                                            const isPriority = (Date.now() - ticket.issueDateTime) > 86400000 && ticket.status !== 'RESOLVED' && ticket.status !== 'REJECTED';

                                            let matchesFilter = true;
                                            if (activityFilter === 'ACTIVE') {
                                                matchesFilter = ticket.status !== 'RESOLVED' && ticket.status !== 'REJECTED';
                                            } else if (activityFilter === 'RESOLVED') {
                                                matchesFilter = ticket.status === 'RESOLVED' || ticket.status === 'REJECTED';
                                            } else if (activityFilter === 'PRIORITY') {
                                                matchesFilter = isPriority;
                                            }

                                            return matchesSearch && matchesFilter;
                                        })
                                        .map(ticket => {
                                            const agent = agents.find(a => a.agentId === ticket.agentId);
                                            const isPriority = (Date.now() - ticket.issueDateTime) > 86400000 && ticket.status !== 'RESOLVED' && ticket.status !== 'REJECTED';

                                            return (
                                                <tr key={ticket.ticketId} style={styles.tr} onClick={() => setSelectedTicket(ticket)}>
                                                    <td style={{ ...styles.td, fontSize: '0.7rem', color: isPriority ? '#ef4444' : 'var(--accent-yellow)', fontWeight: '700' }}>
                                                        {ticket.ticketId}
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
                                        { label: 'Total Tickets', count: activity.length, color: '#facc15' },
                                        { label: 'Total Resolved', count: wsResolvedCount, color: '#34d399' },
                                        { label: 'Total Pending', count: wsPendingCount, color: '#fb923c' },
                                        { label: 'Total Rejected', count: wsRejectedCount, color: '#ef4444' },
                                        { label: 'Total Open', count: wsOpenCount, color: '#60a5fa' },
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
            </main>

            {selectedTicket && (
                <TicketModal
                    ticket={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    onUpdate={(updates: Partial<Ticket>) => {
                        updateTicketMutation.mutate({ ticketId: selectedTicket.ticketId, updates });
                    }}
                    onReject={(reason: string) => {
                        const updates = { status: 'REJECTED' as const, rejectionReason: reason, rejectedAt: Date.now() };
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
                            ticketId: `TICK-${Date.now()}`,
                            issueDateTime: Date.now(),
                            status: (ticketData.agentId ? 'ASSIGNED' : 'OPEN') as Ticket['status'],
                            createdBy: user?.id,
                            attachments: []
                        };
                        createTicketMutation.mutate(newTicket);
                    }}
                    isLoading={createTicketMutation.isPending}
                />
            )}

            {selectedAgent && (
                <AgentDetailsModal
                    agent={selectedAgent}
                    session={sessions.find(s => s.agentId === selectedAgent.agentId)}
                    onClose={() => setSelectedAgent(null)}
                />
            )}

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
        </div>
    );
};

export default SupervisorDashboard;
