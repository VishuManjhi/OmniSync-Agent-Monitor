import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/SocketContext';
import { fetchAgents, fetchSessions, fetchQueueStats, updateTicket, forceLogout, createTicket, fetchTickets } from '../api/agent';
import type { Agent, AgentSession, QueueStats, Ticket } from '../api/types';
import { Users, Phone, Clock, Activity, LogOut, Search, CheckCircle, Eye, ShieldOff, Plus, X } from 'lucide-react';
import Modal from './ui/Modal';

const SupervisorDashboard: React.FC = () => {
    const { logout, user } = useAuth();
    const { lastMessage, sendMessage } = useWebSocket();

    const [agents, setAgents] = useState<Agent[]>([]);
    const [sessions, setSessions] = useState<AgentSession[]>([]);
    const [stats, setStats] = useState<QueueStats | null>(null);
    const [activity, setActivity] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [showCreateTicket, setShowCreateTicket] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [view, setView] = useState<'MONITOR' | 'ACTIVITY' | 'WORKSTATION'>('MONITOR');
    const [activityFilter, setActivityFilter] = useState('ALL');

    const resolvedTickets = activity.filter(t => t.status === 'RESOLVED' && t.startedAt && t.resolvedAt);
    const totalAHTMs = resolvedTickets.reduce((acc, t) => acc + (t.resolvedAt! - t.startedAt!), 0);
    const avgAHTMs = resolvedTickets.length > 0 ? totalAHTMs / resolvedTickets.length : 0;

    const formatAHT = (ms: number) => {
        if (ms === 0) return '—';
        const totalSecs = Math.floor(ms / 1000);
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return `${m}m ${s}s`;
    };

    const currentAHT = formatAHT(avgAHTMs);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadInitialData = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [agentsData, sessionsData, statsData, activityData] = await Promise.all([
                fetchAgents(),
                fetchSessions(),
                fetchQueueStats(),
                fetchTickets()
            ]);
            setAgents(agentsData);
            setSessions(sessionsData);
            setStats(statsData);
            setActivity(activityData);
        } catch (err: any) {
            console.error('Failed to load dashboard data', err);
            setLoadError(err?.message ?? String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.id) return;
        loadInitialData();
    }, [user?.id]);

    // Listen for real-time WebSocket updates
    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type === 'AGENT_STATUS_CHANGE' || lastMessage.type === 'AGENT_STATUS') {
            const { session } = lastMessage;

            // Comprehensive refresh to ensure SLA and other counts update too
            fetchSessions().then(setSessions);
            fetchQueueStats().then(setStats);

            if (session) {
                setSessions(prev => {
                    const index = prev.findIndex(s => s.agentId === session.agentId);
                    if (index !== -1) {
                        const newSessions = [...prev];
                        newSessions[index] = session;
                        return newSessions;
                    }
                    return [...prev, session];
                });
            }
        }

        if (lastMessage.type === 'stats_update') {
            setStats(lastMessage.stats);
        }

        // Ticket events (created/updated/deleted) are broadcast via WebSocket by other clients
        try {
            const t = String(lastMessage.type || '').toLowerCase();
            if (t.includes('ticket')) {
                // refetch tickets to keep UI in sync
                fetchTickets().then((data) => {
                    setActivity(data);
                    console.log('[Supervisor] refreshed tickets after ws event', lastMessage.type);
                }).catch(err => console.error('[Supervisor] failed to reload tickets', err));
            }
        } catch (err) {
            // ignore
        }
    }, [lastMessage]);

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

                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column' }}>
                        <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Loading dashboard...</div>
                    </div>
                ) : loadError ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ color: 'var(--accent-red)', fontWeight: 700 }}>Failed to load data</div>
                        <div style={{ color: 'var(--text-muted)' }}>{loadError}</div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button onClick={loadInitialData} style={styles.createBtn}>Retry</button>
                        </div>
                    </div>
                ) : view === 'MONITOR' ? (
                    <>
                        <div style={styles.grid}>
                            {agents
                                .filter(a => {
                                    const session = sessions.find(s => s.agentId === a.agentId);
                                    const status = (!session || session.clockOutTime)
                                        ? 'OFFLINE'
                                        : (session.breaks && session.breaks.at(-1) && !session.breaks.at(-1).breakOut)
                                            ? 'ON_BREAK'
                                            : (session.onCall ? 'ON_CALL' : 'ACTIVE');
                                    const matchesSearch = a.name.toUpperCase().includes(searchTerm) || a.agentId.toUpperCase().includes(searchTerm);
                                    const matchesFilter = statusFilter === 'ALL' || status === statusFilter;
                                    return matchesSearch && matchesFilter;
                                })
                                .map(agent => (
                                    <AgentCard
                                        key={agent.agentId}
                                        agent={agent}
                                        session={sessions.find(s => s.agentId === agent.agentId)}
                                        onForceLogout={async (id) => {
                                            if (confirm(`FORCE LOGOUT AGENT ${id}?`)) {
                                                await forceLogout(id);
                                            }
                                        }}
                                        onClick={() => setSelectedAgent(agent)}
                                    />
                                ))
                            }
                        </div>

                        {/* Redesigned Recent Tickets Section */}
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
                                            const search = searchTerm.toUpperCase();
                                            const matchesSearch = !searchTerm ||
                                                ticket.ticketId.toUpperCase().includes(search) ||
                                                ticket.agentId.toUpperCase().includes(search) ||
                                                (agent && agent.name.toUpperCase().includes(search));

                                            // Priority Logic: > 24 hours (86400000 ms)
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
                    </div>
                ) : (
                    <div style={styles.workstationGrid}>
                        <div className="glass-card" style={styles.workstationCard}>
                            <h3 style={styles.sectionTitle}>WorkStation Metrics</h3>
                            <div style={styles.metricsGrid}>
                                <div style={styles.metricItem}>
                                    <span style={styles.metricLabel}>Total Agents</span>
                                    <span style={styles.metricValue}>{agents.length}</span>
                                </div>
                                <div style={styles.metricItem}>
                                    <span style={styles.metricLabel}>Active Agents</span>
                                    <span style={styles.metricValue}>{sessions.filter(s => !s.clockOutTime).length}</span>
                                </div>
                                <div style={styles.metricItem}>
                                    <span style={styles.metricLabel}>Tickets Raised</span>
                                    <span style={styles.metricValue}>{activity.length}</span>
                                </div>
                                <div style={styles.metricItem}>
                                    <span style={styles.metricLabel}>Tickets Resolved</span>
                                    <span style={styles.metricValue}>{activity.filter(t => t.status === 'RESOLVED').length}</span>
                                </div>
                                <div style={styles.metricItem}>
                                    <span style={styles.metricLabel}>AHT (Avg Handle Time)</span>
                                    <span style={styles.metricValue}>{currentAHT}</span>
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
                    onUpdate={async (updates: Partial<Ticket>) => {
                        await updateTicket(selectedTicket.ticketId, updates);
                        setActivity(prev => prev.map(t => t.ticketId === selectedTicket.ticketId ? { ...t, ...updates } : t));
                        setSelectedTicket(null);
                    }}
                    onReject={async (reason: string) => {
                        const updates = { status: 'REJECTED' as const, rejectionReason: reason, rejectedAt: Date.now() };
                        await updateTicket(selectedTicket.ticketId, updates);
                        setActivity(prev => prev.map(t => t.ticketId === selectedTicket.ticketId ? { ...t, ...updates } : t));
                        setSelectedTicket(null);
                    }}
                />
            )}

            {showCreateTicket && (
                <CreateTicketModal
                    agents={agents}
                    onClose={() => setShowCreateTicket(false)}
                    onSubmit={async (ticketData) => {
                        const newTicket = {
                            ...ticketData,
                            ticketId: `TICK-${Date.now()}`,
                            issueDateTime: Date.now(),
                            status: ticketData.agentId ? 'ASSIGNED' : 'OPEN',
                            createdBy: user?.id,
                            attachments: []
                        };
                        await createTicket(newTicket);

                        // Broadcast assignment via WebSocket
                        if (newTicket.agentId) {
                            try {
                                sendMessage({
                                    type: 'ASSIGN_TICKET',
                                    agentId: newTicket.agentId,
                                    ticket: newTicket
                                });
                            } catch (e) { console.error('WS Error broadcasting assignment', e); }
                        }

                        setShowCreateTicket(false);
                        const updatedTickets = await fetchTickets();
                        setActivity(updatedTickets);
                    }}
                />
            )}

            {selectedAgent && (
                <AgentDetailsModal
                    agent={selectedAgent}
                    session={sessions.find(s => s.agentId === selectedAgent.agentId)}
                    onClose={() => setSelectedAgent(null)}
                />
            )}
        </div>
    );
};

const TicketModal: React.FC<{
    ticket: Ticket,
    onClose: () => void,
    onUpdate: (updates: Partial<Ticket>) => Promise<void>,
    onReject: (reason: string) => Promise<void>
}> = ({ ticket, onClose, onUpdate, onReject }) => {
    const [loading, setLoading] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleApprove = async () => {
        setLoading(true);
        try {
            await onUpdate({ status: 'RESOLVED', resolvedAt: Date.now() });
        } catch (err) {
            console.error('Approve failed', err);
            alert('Failed to approve ticket');
        } finally {
            setLoading(false);
        }
    };

    const handleRejectSubmit = async () => {
        if (!rejectionReason.trim()) return;
        setLoading(true);
        try {
            await onReject(rejectionReason);
        } catch (err) {
            console.error('Reject failed', err);
            alert('Failed to reject ticket');
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <div className="flex gap-3" style={{ width: '100%', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
            {!isRejecting ? (
                <>
                    {(ticket.status === 'RESOLUTION_REQUESTED' || ticket.status === 'OPEN') && (
                        <>
                            <button
                                style={{ ...styles.resolveBtn, cursor: loading ? 'not-allowed' : 'pointer' }}
                                onClick={handleApprove}
                                disabled={loading}
                            >
                                <CheckCircle size={16} /> APPROVE
                            </button>
                            <button
                                style={{ ...styles.rejectBtn, cursor: loading ? 'not-allowed' : 'pointer' }}
                                onClick={() => setIsRejecting(true)}
                                disabled={loading}
                            >
                                <X size={16} /> REJECT
                            </button>
                        </>
                    )}
                    <button style={styles.closeBtn} onClick={onClose}>CLOSE</button>
                </>
            ) : (
                <>
                    <button
                        style={{ ...styles.rejectBtn, background: '#ef4444', color: 'white', cursor: loading ? 'not-allowed' : 'pointer' }}
                        onClick={handleRejectSubmit}
                        disabled={loading || !rejectionReason.trim()}
                    >
                        CONFIRM REJECTION
                    </button>
                    <button
                        style={styles.closeBtn}
                        onClick={() => { setIsRejecting(false); setRejectionReason(''); }}
                        disabled={loading}
                    >
                        CANCEL
                    </button>
                </>
            )}
        </div>
    );

    return (
        <Modal open={true} onOpenChange={(v) => { if (!v && !loading) onClose(); }} title={isRejecting ? "REJECT TICKET" : "TICKET DETAILS"} footer={footer}>
            <div className="space-y-3 text-sm">
                {!isRejecting ? (
                    <>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>TICKET ID</span>
                            <span style={styles.detailValue}>{ticket.ticketId}</span>
                        </div>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>AGENT</span>
                            <span style={styles.detailValue}>{ticket.agentId}</span>
                        </div>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>STATUS</span>
                            <span style={{ ...styles.statusBadge, width: 'fit-content', fontSize: '0.8rem' }}>{ticket.status}</span>
                        </div>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>DESCRIPTION</span>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.5' }}>{ticket.description}</p>
                        </div>
                    </>
                ) : (
                    <div style={styles.formGroup}>
                        <label style={styles.label}>REASON FOR REJECTION</label>
                        <textarea
                            style={{ ...styles.input, height: '120px', resize: 'none' }}
                            placeholder="Please provide a reason for rejecting this resolution request..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            autoFocus
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};



// ... TicketModal ...

const CreateTicketModal: React.FC<{
    agents: Agent[],
    onClose: () => void,
    onSubmit: (data: any) => Promise<void>
}> = ({ agents, onClose, onSubmit }) => {
    const [form, setForm] = useState({ agentId: '', issueType: '', description: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const filteredAgents = agents.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.agentId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAgentSelect = (agent: Agent) => {
        setForm({ ...form, agentId: agent.agentId });
        setSearchTerm(`${agent.name} (${agent.agentId})`);
        setIsDropdownOpen(false);
    };

    return (
        <div style={styles.modalOverlay}>
            <div className="glass-card" style={styles.modal}>
                <div style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>CREATE TICKET</h3>
                    <button onClick={onClose} style={styles.iconBtn}><X size={20} /></button>
                </div>
                <div style={styles.modalContent}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>ASSIGN TO AGENT</label>
                        <div style={{ position: 'relative' }}>
                            <div style={styles.inputWrapper}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                                <input
                                    style={{ ...styles.input, paddingLeft: '36px' }}
                                    placeholder="Search Agent..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setIsDropdownOpen(true);
                                        if (e.target.value === '') setForm({ ...form, agentId: '' });
                                    }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                />
                                {form.agentId && (
                                    <button
                                        onClick={() => { setForm({ ...form, agentId: '' }); setSearchTerm(''); }}
                                        style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {isDropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    background: '#0a0a0a',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '8px',
                                    marginTop: '4px',
                                    zIndex: 100,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                                }}>
                                    <div
                                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', fontSize: '0.85rem' }}
                                        onClick={() => {
                                            setForm({ ...form, agentId: '' });
                                            setSearchTerm('');
                                            setIsDropdownOpen(false);
                                        }}
                                    >
                                        <span style={{ color: 'var(--text-muted)' }}>UNASSIGNED</span>
                                    </div>
                                    {filteredAgents.map(a => (
                                        <div
                                            key={a.agentId}
                                            style={{
                                                padding: '8px 12px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                background: form.agentId === a.agentId ? 'rgba(250, 204, 21, 0.1)' : 'transparent'
                                            }}
                                            onClick={() => handleAgentSelect(a)}
                                        >
                                            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{a.name}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.agentId}</span>
                                        </div>
                                    ))}
                                    {filteredAgents.length === 0 && (
                                        <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                                            No agents found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>ISSUE TYPE</label>
                        <input
                            style={styles.input}
                            placeholder="e.g. SYSTEM SLOWNESS"
                            value={form.issueType}
                            onChange={(e) => setForm({ ...form, issueType: e.target.value })}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>DESCRIPTION</label>
                        <textarea
                            style={{ ...styles.input, height: '100px', resize: 'none' }}
                            placeholder="DESCRIBE THE ISSUE..."
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </div>
                    <button
                        style={styles.submitBtn}
                        onClick={() => onSubmit(form)}
                    >
                        CREATE TICKET
                    </button>
                </div>
            </div>
        </div>
    );
};

const AgentDetailsModal: React.FC<{
    agent: Agent,
    session?: AgentSession,
    onClose: () => void
}> = ({ agent, session, onClose }) => {
    return (
        <div style={styles.modalOverlay}>
            <div className="glass-card" style={{ ...styles.modal, maxWidth: '600px' }}>
                <div style={styles.modalHeader}>
                    <div style={styles.agentDetailHeader}>
                        <h3 style={styles.modalTitle}>{agent.name}</h3>
                        <span style={styles.agentIdTag}>{agent.agentId}</span>
                    </div>
                    <button onClick={onClose} style={styles.iconBtn}><X size={20} /></button>
                </div>
                <div style={styles.modalContent}>
                    <div style={styles.detailGrid}>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>STATUS</span>
                            <span style={styles.detailValue}>{deriveAgentStatus(session)}</span>
                        </div>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>CLOCKED IN</span>
                            <span style={styles.detailValue}>{session?.clockInTime ? new Date(session.clockInTime).toLocaleTimeString() : '—'}</span>
                        </div>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>CLOCKED OUT</span>
                            <span style={styles.detailValue}>{session?.clockOutTime ? new Date(session.clockOutTime).toLocaleTimeString() : '—'}</span>
                        </div>
                    </div>

                    <div style={styles.sectionDivider}>BREAK HISTORY</div>
                    <div style={styles.breakTimeline}>
                        {session?.breaks && session.breaks.length > 0 ? (
                            session.breaks.map((b, i) => (
                                <div key={i} style={styles.timelineItem}>
                                    <div style={styles.timelinePoint} />
                                    <div style={styles.timelineContent}>
                                        <span style={styles.timelineTime}>
                                            {new Date(b.breakIn).toLocaleTimeString()} —
                                            {b.breakOut ? new Date(b.breakOut).toLocaleTimeString() : 'ONGOING'}
                                        </span>
                                        <span style={styles.timelineLabel}>BREAK SESSION</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={styles.emptyText}>NO BREAK DATA AVAILABLE</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const deriveAgentStatus = (session?: AgentSession) => {
    if (!session || session.clockOutTime) return 'OFFLINE';
    const lastBreak = session.breaks?.at(-1);
    if (lastBreak && !lastBreak.breakOut) return 'ON_BREAK';
    if (session.onCall) return 'ON_CALL';
    return 'ACTIVE';
};

const StatCard: React.FC<{ icon: React.ReactNode, label: string, value: string | number }> = ({ icon, label, value }) => (
    <div style={styles.statCard}>
        <div style={styles.statIcon}>{icon}</div>
        <div style={styles.statInfo}>
            <span style={styles.statLabel}>{label}</span>
            <span style={styles.statValue}>{value}</span>
        </div>
    </div>
);

const AgentCard: React.FC<{
    agent: Agent,
    session?: AgentSession,
    onForceLogout: (id: string) => Promise<void>,
    onClick: () => void
}> = ({ agent, session, onForceLogout, onClick }) => {
    const status = deriveAgentStatus(session);
    const statusColor = status === 'OFFLINE' ? 'var(--text-muted)' :
        status === 'ON_CALL' ? 'var(--accent-blue)' :
            status === 'ON_BREAK' ? 'var(--accent-yellow)' : '#10b981';

    return (
        <div className="glass-card" style={styles.agentCard} onClick={onClick}>
            <div style={styles.agentHeader}>
                <div style={styles.agentInfo}>
                    <h3 style={styles.agentName}>{agent.name}</h3>
                    <span style={styles.agentId}>{agent.agentId}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {status !== 'OFFLINE' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onForceLogout(agent.agentId);
                            }}
                            style={styles.forceBtn}
                            title="Force Logout"
                        >
                            <ShieldOff size={14} />
                        </button>
                    )}
                    <div style={{ ...styles.statusDot, background: statusColor }} />
                </div>
            </div>

            <div style={styles.cardContent}>
                <div style={styles.statusLabel}>
                    <Clock size={14} style={{ marginRight: '4px' }} />
                    {status}
                </div>
                {status === 'OFFLINE' && session?.clockOutTime && (
                    <div style={{ ...styles.statusLabel, marginTop: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Out: {new Date(session.clockOutTime).toLocaleTimeString()}
                    </div>
                )}
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    dashboard: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem',
        maxWidth: '1440px',
        margin: '0 auto',
        gap: '1.5rem',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 0',
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
        letterSpacing: '-0.02em',
        textTransform: 'uppercase',
    },
    badge: {
        fontSize: '0.6rem',
        background: 'rgba(250, 204, 21, 0.1)',
        color: 'var(--accent-yellow)',
        padding: '2px 8px',
        borderRadius: '4px',
        letterSpacing: '0.1em',
        fontWeight: '700',
        width: 'fit-content',
    },
    statsRow: {
        display: 'flex',
        gap: '2rem',
    },
    statCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    statInfo: {
        display: 'flex',
        flexDirection: 'column',
    },
    statLabel: {
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontWeight: '700',
    },
    statValue: {
        fontSize: '1.25rem',
        fontWeight: '800',
        color: 'white',
    },
    logoutBtn: {
        background: 'transparent',
        border: '1px solid var(--glass-border)',
        color: 'var(--text-primary)',
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.8rem',
        fontWeight: '600',
    },
    main: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    controlBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    searchBox: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        border: '1px solid var(--glass-border)',
        borderRadius: '10px',
        padding: '0 12px',
        width: '300px',
    },
    searchInput: {
        background: 'transparent',
        border: 'none',
        padding: '10px',
        color: 'white',
        outline: 'none',
        fontSize: '0.8rem',
        fontWeight: '600',
        flex: 1,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '1rem',
    },
    agentCard: {
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    agentHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    agentInfo: {
        display: 'flex',
        flexDirection: 'column',
    },
    agentName: {
        fontSize: '1.1rem',
        fontWeight: '800',
        letterSpacing: '-0.01em',
    },
    agentId: {
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        fontWeight: '600',
    },
    forceBtn: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
        padding: '4px',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
    },
    statusDot: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
    },
    statusLabel: {
        fontSize: '0.75rem',
        fontWeight: '700',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
    },
    viewTabs: {
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        borderBottom: '1px solid var(--glass-border)',
        paddingBottom: '0.5rem',
    },
    viewTab: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-muted)',
        fontSize: '0.9rem',
        fontWeight: '600',
        padding: '0.5rem 1rem',
    },
    activeViewTab: {
        color: 'var(--accent-yellow)',
        borderBottom: '2px solid var(--accent-yellow)',
    },
    activityLog: {
        padding: '1.5rem',
        overflowX: 'auto',
    },
    sectionTitle: {
        color: 'var(--accent-yellow)',
        marginBottom: '1rem',
        textTransform: 'uppercase',
        fontSize: '1rem',
        letterSpacing: '0.05em',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    th: {
        textAlign: 'left',
        padding: '1rem',
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
    },
    td: {
        padding: '1rem',
        borderTop: '1px solid var(--glass-border)',
        fontSize: '0.85rem',
    },
    tr: {
        transition: 'background 0.2s',
        cursor: 'default',
    },
    statusBadge: {
        padding: '2px 8px',
        borderRadius: '4px',
        border: '1px solid',
        fontSize: '0.7rem',
        fontWeight: '700',
    },
    iconBtn: {
        background: 'transparent',
        border: 'none',
        color: 'var(--accent-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
    },
    modal: {
        width: '100%',
        maxWidth: '500px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    modalTitle: {
        color: 'var(--accent-yellow)',
        fontSize: '1.25rem',
        textTransform: 'uppercase',
    },
    modalContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        color: 'var(--text-secondary)',
    },
    modalActions: {
        display: 'flex',
        gap: '1rem',
        marginTop: '1rem',
    },
    actions: {
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
    },
    filterSelect: {
        background: 'var(--bg-card)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '0.5rem 1rem',
        color: 'var(--text-primary)',
        fontSize: '0.8rem',
        fontWeight: '700',
        outline: 'none',
        cursor: 'pointer',
    },
    createBtn: {
        background: 'var(--accent-yellow)',
        color: 'black',
        border: 'none',
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        fontWeight: '800',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginBottom: '1rem',
    },
    label: {
        fontSize: '0.65rem',
        fontWeight: '700',
        color: 'var(--text-muted)',
        letterSpacing: '0.05em',
    },
    input: {
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        padding: '0.75rem',
        color: 'white',
        fontSize: '0.9rem',
        outline: 'none',
    },
    submitBtn: {
        background: 'var(--accent-blue)',
        color: 'white',
        border: 'none',
        padding: '1rem',
        borderRadius: '8px',
        fontWeight: '800',
        width: '100%',
        marginTop: '0.5rem',
        cursor: 'pointer',
    },
    agentDetailHeader: {
        display: 'flex',
        flexDirection: 'column',
    },
    agentIdTag: {
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        fontWeight: '700',
    },
    detailGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginBottom: '1.5rem',
    },
    detailItem: {
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--glass-bg)',
        padding: '1rem',
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
    },
    detailLabel: {
        fontSize: '0.6rem',
        color: 'var(--text-muted)',
        fontWeight: '700',
        marginBottom: '0.25rem',
    },
    detailValue: {
        fontSize: '1rem',
        fontWeight: '800',
        color: 'white',
    },
    sectionDivider: {
        fontSize: '0.7rem',
        fontWeight: '800',
        color: 'var(--accent-yellow)',
        letterSpacing: '0.1em',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    breakTimeline: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    timelineItem: {
        display: 'flex',
        gap: '1rem',
        position: 'relative',
        paddingLeft: '0.5rem',
    },
    timelinePoint: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'var(--accent-yellow)',
        marginTop: '0.4rem',
    },
    timelineContent: {
        display: 'flex',
        flexDirection: 'column',
    },
    timelineTime: {
        fontSize: '0.85rem',
        fontWeight: '700',
        color: 'white',
    },
    timelineLabel: {
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        fontWeight: '600',
    },
    emptyText: {
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
        textAlign: 'center',
        padding: '1rem',
    },
    resolveBtn: {
        background: '#10b981',
        color: 'white',
        border: 'none',
        padding: '0.75rem 1.25rem',
        borderRadius: '8px',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    closeBtn: {
        background: 'transparent',
        border: '1px solid var(--glass-border)',
        color: 'var(--text-primary)',
        padding: '0.75rem 1.25rem',
        borderRadius: '8px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    rejectBtn: {
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        padding: '0.75rem 1.25rem',
        borderRadius: '8px',
        fontWeight: '700',
        cursor: 'pointer',
    },
    workstationGrid: {
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 600px)',
        gap: '1.5rem',
        justifyContent: 'center',
        marginTop: '1rem',
    },
    workstationCard: {
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
    },
    metricsGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
    },
    metricItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '1.5rem',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        alignItems: 'center',
    },
    metricLabel: {
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
    },
    metricValue: {
        fontSize: '2rem',
        fontWeight: '900',
        color: 'white',
    },
    recentTicketsSection: {
        marginTop: '1.5rem',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    sectionIndicator: {
        width: '4px',
        height: '24px',
        background: 'var(--accent-blue)',
        borderRadius: '2px',
    },
    scrollContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxHeight: '400px',
        overflowY: 'auto',
        paddingRight: '8px',
    },
    ticketDetailCard: {
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        cursor: 'pointer',
    },
    ticketCardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ticketIdText: {
        fontSize: '1rem',
        fontWeight: '900',
        color: 'var(--accent-blue)',
        fontFamily: 'monospace',
    },
    ticketCardRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ticketRowLabel: {
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
    },
    ticketRowValue: {
        fontSize: '0.8rem',
        fontWeight: '800',
        color: 'white',
        textTransform: 'uppercase',
    },
    descriptionBox: {
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '8px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        color: 'var(--text-primary)',
        lineHeight: '1.4',
    },
    ticketCardFooter: {
        display: 'flex',
        justifyContent: 'flex-end',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
    },
    ticketActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.75rem',
        marginTop: '0.5rem',
    },
    approveBtn: {
        background: '#10b981',
        color: 'white',
        border: 'none',
        padding: '0.4rem 1.25rem',
        borderRadius: '6px',
        fontWeight: '900',
        fontSize: '0.65rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    rejectCardBtn: {
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        padding: '0.4rem 1.25rem',
        borderRadius: '6px',
        fontWeight: '900',
        fontSize: '0.65rem',
        cursor: 'pointer',
    },
};

export default SupervisorDashboard;
