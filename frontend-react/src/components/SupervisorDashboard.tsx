import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/SocketContext';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchAgents, fetchSessions, fetchQueueStats, updateTicket, forceLogout, createTicket, fetchTickets, fetchAgentTickets, fetchAsyncJobs, fetchSlaBreaches, runSlaAutomation } from '../api/agent';
import type { Agent, AgentSession, Ticket, AsyncJobItem } from '../api/types';
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
    const [view, setView] = useState<'MONITOR' | 'AGENTS' | 'REPORTS' | 'JOBS' | 'AUTOMATION' | 'ACTIVITY' | 'WORKSTATION' | 'MESSAGING'>('MONITOR');

    const [activityFilter, setActivityFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [confirmLogoutAgent, setConfirmLogoutAgent] = useState<string | null>(null);
    const [nowTs, setNowTs] = useState(() => Date.now());
    const [reportAgentId, setReportAgentId] = useState<string | null>(null);
    const [jobsPage, setJobsPage] = useState(1);
    const [slaPage, setSlaPage] = useState(1);

    // Queries
    const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
        queryKey: ['agents'],
        queryFn: fetchAgents,
        enabled: !!user?.id,
        refetchInterval: 15000,
        refetchIntervalInBackground: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retry: 3
    });

    const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
        queryKey: ['sessions'],
        queryFn: fetchSessions,
        enabled: !!user?.id,
        refetchInterval: 10000,
        refetchIntervalInBackground: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retry: 3
    });

    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ['queue-stats'],
        queryFn: fetchQueueStats,
        enabled: !!user?.id,
        refetchInterval: 10000,
        refetchIntervalInBackground: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retry: 3
    });

    const { data: activityData, isLoading: isLoadingActivity } = useQuery({
        queryKey: ['all-tickets', page, debouncedSearchTerm, activityFilter],
        queryFn: () => fetchTickets(page, 10, debouncedSearchTerm, activityFilter),
        enabled: !!user?.id,
        placeholderData: keepPreviousData,
        refetchInterval: 10000,
        refetchIntervalInBackground: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retry: 3
    });

    const { data: agentTicketsData, isLoading: isLoadingAgentTickets } = useQuery({
        queryKey: ['agent-tickets', selectedAgentDrawer?.agentId, agentTicketsPage],
        queryFn: () => fetchAgentTickets(selectedAgentDrawer!.agentId, agentTicketsPage, 5, '', 'ALL'),
        enabled: !!selectedAgentDrawer?.agentId
    });

    const {
        data: asyncJobsData,
        isLoading: isLoadingJobs,
        refetch: refetchJobs,
        error: jobsError,
        isError: isJobsError
    } = useQuery({
        queryKey: ['async-jobs', jobsPage],
        queryFn: () => fetchAsyncJobs(jobsPage, 10),
        enabled: !!user?.id && view === 'JOBS',
        refetchInterval: view === 'JOBS' ? 5000 : false,
        retry: 1
    });

    const {
        data: slaBreaches,
        isLoading: isLoadingSlaBreaches,
        refetch: refetchSlaBreaches,
        error: slaError,
        isError: isSlaError
    } = useQuery({
        queryKey: ['sla-breaches', slaPage],
        queryFn: () => fetchSlaBreaches(24, slaPage, 10),
        enabled: !!user?.id && view === 'AUTOMATION',
        retry: 1
    });

    const activity = activityData?.tickets || [];
    const totalPages = activityData?.pages || 1;
    const asyncJobs = asyncJobsData?.items || [];
    const jobsTotalPages = asyncJobsData?.pages || 1;
    const jobsCurrentPage = asyncJobsData?.currentPage || jobsPage;
    const slaTotalPages = slaBreaches?.pages || 1;
    const slaCurrentPage = slaBreaches?.currentPage || slaPage;

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
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Failed to update ticket';
            showNotification(message, 'error', 'SYSTEM ERROR');
        }
    });

    const forceLogoutMutation = useMutation({
        mutationFn: forceLogout,
        onSuccess: (_, agentId) => {
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            showNotification(`Agent ${agentId} has been terminated from the session.`, 'success', 'ACCESS REVOKED');
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Failed to logout agent';
            showNotification(message, 'error', 'SYSTEM ERROR');
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
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Failed to create ticket';
            showNotification(message, 'error', 'SYSTEM ERROR');
        }
    });

    const runSlaMutation = useMutation({
        mutationFn: () => runSlaAutomation(24),
        onSuccess: (res) => {
            showNotification(`SLA automation escalated ${res.escalated} tickets`, 'success', 'AUTOMATION COMPLETE');
            refetchSlaBreaches();
            queryClient.invalidateQueries({ queryKey: ['all-tickets'] });
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Failed to run SLA automation';
            showNotification(message, 'error', 'AUTOMATION ERROR');
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

    useEffect(() => {
        const timer = window.setInterval(() => setNowTs(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!isJobsError || view !== 'JOBS') return;
        const message = jobsError instanceof Error ? jobsError.message : 'Failed to load Job Status';
        showNotification(message, 'error', 'JOB STATUS ERROR');
    }, [isJobsError, jobsError, view, showNotification]);

    useEffect(() => {
        if (!isSlaError || view !== 'AUTOMATION') return;
        const message = slaError instanceof Error ? slaError.message : 'Failed to load SLA breaches';
        showNotification(message, 'error', 'AUTOMATION ERROR');
    }, [isSlaError, slaError, view, showNotification]);

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setPage(1);
    };

    const handleActivityFilterChange = (value: string) => {
        setActivityFilter(value);
        setPage(1);
    };

    const handleOpenAgentDrawer = (agent: Agent) => {
        setSelectedAgentDrawer(agent);
        setAgentTicketsPage(1);
    };

    const handleOpenReportForAgent = (agentId: string) => {
        setReportAgentId(agentId);
        setView('REPORTS');
    };

    const handleOpenJobsView = () => {
        setJobsPage(1);
        setView('JOBS');
    };

    const handleOpenAutomationView = () => {
        setSlaPage(1);
        setView('AUTOMATION');
    };

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

    const viewTitleMap: Record<'MONITOR' | 'AGENTS' | 'REPORTS' | 'JOBS' | 'AUTOMATION' | 'ACTIVITY' | 'WORKSTATION' | 'MESSAGING', string> = {
        MONITOR: 'Dashboard',
        AGENTS: 'Agents',
        REPORTS: 'Report Centre',
        JOBS: 'SQS Job Status',
        AUTOMATION: 'SLA Automation',
        ACTIVITY: 'Activity Log',
        WORKSTATION: 'Workstation',
        MESSAGING: 'Messaging'
    };

    return (
        <div style={agentStyles.appLayout}>
            <SupervisorSideNav
                activeView={view}
                setActiveView={(nextView) => {
                    if (nextView === 'JOBS') {
                        handleOpenJobsView();
                        return;
                    }
                    if (nextView === 'AUTOMATION') {
                        handleOpenAutomationView();
                        return;
                    }
                    setView(nextView);
                }}
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
                            onChange={(e) => handleSearchChange(e.target.value)}
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
                                    online={wsActiveCount}
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={styles.sectionIndicator} />
                                    <h2 style={styles.sectionTitle}>Recent Unresolved / Approval Tickets</h2>
                                </div>
                                <button
                                    style={{ ...styles.createBtn, padding: '0.35rem 0.8rem', fontSize: '0.72rem' }}
                                    onClick={() => setView('ACTIVITY')}
                                >
                                    View All
                                </button>
                            </div>

                            <div style={styles.scrollContainer}>
                                {recentlyRaisedUnresolved.map(ticket => (
                                    <div key={ticket.ticketId} style={styles.ticketDetailCard} onClick={() => setSelectedTicket(ticket)}>
                                        <div style={styles.ticketCardHeader}>
                                            <span style={styles.ticketIdText}>{ticket.displayId || `#${ticket.ticketId.substring(0, 8).toUpperCase()}`}</span>
                                            <span style={{
                                                ...styles.statusBadge,
                                                background: 'var(--glass-highlight)',
                                                color: ticket.status === 'RESOLUTION_REQUESTED' ? 'var(--accent-blue)' : 'var(--accent-yellow)',
                                                border: `1px solid ${ticket.status === 'RESOLUTION_REQUESTED' ? 'rgba(59,130,246,0.35)' : 'rgba(250,204,21,0.35)'}`,
                                                padding: '4px 12px',
                                                borderRadius: '999px',
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

                                        <div style={{ ...styles.descriptionBox, background: 'var(--glass-highlight)', border: '1px solid var(--glass-border)' }}>
                                            {ticket.description}
                                        </div>

                                        <div style={{ ...styles.ticketCardFooter, justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 700 }}>
                                                {ticket.assignedBy === 'SUPERVISOR' ? 'Supervisor Assigned' : 'System Ticket'}
                                            </span>
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
                                            onClick={() => handleOpenAgentDrawer(agent)}
                                            onOpenReport={handleOpenReportForAgent}
                                        />
                                    ))}
                            </div>
                        </div>
                    </div>
                ) : view === 'REPORTS' ? (
                    <ReportCentre
                        agents={agents}
                        sessions={sessions}
                        preselectedAgentId={reportAgentId}
                            onJobTriggered={() => {
                                queryClient.invalidateQueries({ queryKey: ['async-jobs'] });
                            }}
                    />
                ) : view === 'JOBS' ? (
                    <div className="glass-card" style={styles.activityLog}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={styles.sectionTitle}>Recent SQS Jobs</h3>
                            <button style={styles.createBtn} onClick={() => refetchJobs()}>
                                Refresh
                            </button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Job ID</th>
                                        <th style={styles.th}>Type</th>
                                        <th style={styles.th}>Status</th>
                                        <th style={styles.th}>Attempts</th>
                                        <th style={styles.th}>Updated</th>
                                    </tr>
                                </thead>
                                <tbody style={{ opacity: isLoadingJobs ? 0.5 : 1 }}>
                                    {asyncJobs.map((job: AsyncJobItem) => (
                                        <tr key={job.jobId} style={styles.tr}>
                                            <td style={styles.td}>{job.jobId.slice(0, 12)}...</td>
                                            <td style={styles.td}>{job.type}</td>
                                            <td style={styles.td}>{job.status}</td>
                                            <td style={styles.td}>{job.attempts || 0}</td>
                                            <td style={styles.td}>{job.updatedAt ? new Date(job.updatedAt).toLocaleString() : '-'}</td>
                                        </tr>
                                    ))}
                                    {!isLoadingJobs && asyncJobs.length === 0 && (
                                        <tr>
                                            <td style={styles.td} colSpan={5}>No jobs found.</td>
                                        </tr>
                                    )}
                                    {isJobsError && (
                                        <tr>
                                            <td style={styles.td} colSpan={5}>
                                                {jobsError instanceof Error ? jobsError.message : 'Failed to load jobs'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1rem', gap: '1rem' }}>
                            <button
                                onClick={() => setJobsPage(p => Math.max(1, p - 1))}
                                disabled={jobsCurrentPage === 1}
                                style={{ ...styles.createBtn, opacity: jobsCurrentPage === 1 ? 0.5 : 1, padding: '0.5rem 1rem' }}
                            >
                                Previous
                            </button>
                            <span style={{ color: 'var(--text-light)', fontWeight: '600', fontSize: '0.9rem' }}>
                                Page {jobsCurrentPage} of {jobsTotalPages}
                            </span>
                            <button
                                onClick={() => setJobsPage(p => Math.min(jobsTotalPages, p + 1))}
                                disabled={jobsCurrentPage === jobsTotalPages}
                                style={{ ...styles.createBtn, opacity: jobsCurrentPage === jobsTotalPages ? 0.5 : 1, padding: '0.5rem 1rem' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                ) : view === 'AUTOMATION' ? (
                    <div className="glass-card" style={styles.activityLog}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={styles.sectionTitle}>SLA Breach Automation (24h)</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button style={styles.filterSelect} onClick={() => refetchSlaBreaches()}>
                                    Refresh
                                </button>
                                <button
                                    style={{ ...styles.createBtn, opacity: runSlaMutation.isPending ? 0.7 : 1 }}
                                    onClick={() => runSlaMutation.mutate()}
                                    disabled={runSlaMutation.isPending}
                                >
                                    {runSlaMutation.isPending ? 'Running...' : 'Run Automation'}
                                </button>
                            </div>
                        </div>
                        <div style={{ marginBottom: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                            Total breached unresolved tickets: {slaBreaches?.total || 0}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Ticket</th>
                                        <th style={styles.th}>Agent</th>
                                        <th style={styles.th}>Issue</th>
                                        <th style={styles.th}>Status</th>
                                        <th style={styles.th}>Raised</th>
                                    </tr>
                                </thead>
                                <tbody style={{ opacity: isLoadingSlaBreaches ? 0.5 : 1 }}>
                                    {(slaBreaches?.breaches || []).map(ticket => (
                                        <tr key={ticket.ticketId} style={styles.tr} onClick={() => setSelectedTicket(ticket)}>
                                            <td style={styles.td}>{ticket.displayId || ticket.ticketId}</td>
                                            <td style={styles.td}>{ticket.agentId}</td>
                                            <td style={styles.td}>{ticket.issueType}</td>
                                            <td style={styles.td}>{ticket.status}</td>
                                            <td style={styles.td}>{new Date(ticket.issueDateTime).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {!isLoadingSlaBreaches && (slaBreaches?.breaches || []).length === 0 && (
                                        <tr>
                                            <td style={styles.td} colSpan={5}>No SLA breaches currently.</td>
                                        </tr>
                                    )}
                                    {isSlaError && (
                                        <tr>
                                            <td style={styles.td} colSpan={5}>
                                                {slaError instanceof Error ? slaError.message : 'Failed to load SLA breaches'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1rem', gap: '1rem' }}>
                            <button
                                onClick={() => setSlaPage(p => Math.max(1, p - 1))}
                                disabled={slaCurrentPage === 1}
                                style={{ ...styles.createBtn, opacity: slaCurrentPage === 1 ? 0.5 : 1, padding: '0.5rem 1rem' }}
                            >
                                Previous
                            </button>
                            <span style={{ color: 'var(--text-light)', fontWeight: '600', fontSize: '0.9rem' }}>
                                Page {slaCurrentPage} of {slaTotalPages}
                            </span>
                            <button
                                onClick={() => setSlaPage(p => Math.min(slaTotalPages, p + 1))}
                                disabled={slaCurrentPage === slaTotalPages}
                                style={{ ...styles.createBtn, opacity: slaCurrentPage === slaTotalPages ? 0.5 : 1, padding: '0.5rem 1rem' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                ) : view === 'ACTIVITY' ? (
                    <div className="glass-card" style={styles.activityLog}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={styles.sectionTitle}>Recent Activity</h3>
                            <select
                                value={activityFilter}
                                onChange={(e) => handleActivityFilterChange(e.target.value)}
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
                                            const isPriority = (nowTs - ticket.issueDateTime) > 86400000 && ticket.status !== 'RESOLVED' && ticket.status !== 'REJECTED';

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
