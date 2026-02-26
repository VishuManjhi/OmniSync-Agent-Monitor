import React, { useState } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { styles } from './agentDashboardStyles';
import { PerformanceAreaChart } from '../../analytics/PerformanceCharts';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentTickets } from '../../../api/agent';
import type { AgentAnalytics, Ticket } from '../../../api/types';

interface MetricsTabProps {
    agentId: string;
    agentAnalytics: AgentAnalytics | undefined;
}

const MetricsTab: React.FC<MetricsTabProps> = ({ agentId, agentAnalytics }) => {
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const limit = 5;

    const stats = agentAnalytics?.overallRatio || {
        totalRaised: 0,
        totalResolved: 0,
        totalRejected: 0
    };

    const avgHandleTime = agentAnalytics?.avgHandleTime || 0;
    const ticketHistory = agentAnalytics?.ticketHistory || [];

    // Query for selected status tickets
    const { data: ticketsData, isLoading: isLoadingTickets } = useQuery({
        queryKey: ['metricsTickets', agentId, selectedStatus, page],
        queryFn: () => fetchAgentTickets(agentId, page, limit, '', selectedStatus || 'ALL'),
        enabled: !!selectedStatus && !!agentId
    });

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleMetricClick = (status: string) => {
        if (selectedStatus === status) {
            setSelectedStatus(null);
        } else {
            setSelectedStatus(status);
            setPage(1);
        }
    };

    return (
        <div style={styles.dashboardView} className="fade-in">
            <div style={styles.kpiGrid}>
                <div
                    onClick={() => handleMetricClick('RAISED')}
                    className="glass-card"
                    style={{
                        ...styles.kpiCard,
                        cursor: 'pointer',
                        borderLeft: '4px solid var(--accent-blue)',
                        background: selectedStatus === 'RAISED' ? 'var(--glass-highlight)' : 'var(--bg-card)',
                        transform: selectedStatus === 'RAISED' ? 'translateY(-2px)' : 'none',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{ ...styles.kpiIcon, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div style={styles.kpiInfo}>
                        <span style={styles.kpiLabel}>Total Raised</span>
                        <h2 style={styles.kpiValue}>{stats.totalRaised}</h2>
                    </div>
                </div>

                <div
                    onClick={() => handleMetricClick('RESOLVED')}
                    className="glass-card"
                    style={{
                        ...styles.kpiCard,
                        cursor: 'pointer',
                        borderLeft: '4px solid #10b981',
                        background: selectedStatus === 'RESOLVED' ? 'var(--glass-highlight)' : 'var(--bg-card)',
                        transform: selectedStatus === 'RESOLVED' ? 'translateY(-2px)' : 'none',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{ ...styles.kpiIcon, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <CheckCircle size={24} />
                    </div>
                    <div style={styles.kpiInfo}>
                        <span style={styles.kpiLabel}>Total Resolved</span>
                        <h2 style={styles.kpiValue}>{stats.totalResolved}</h2>
                    </div>
                </div>

                <div
                    onClick={() => handleMetricClick('REJECTED')}
                    className="glass-card"
                    style={{
                        ...styles.kpiCard,
                        cursor: 'pointer',
                        borderLeft: '4px solid var(--accent-error)',
                        background: selectedStatus === 'REJECTED' ? 'var(--glass-highlight)' : 'var(--bg-card)',
                        transform: selectedStatus === 'REJECTED' ? 'translateY(-2px)' : 'none',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{ ...styles.kpiIcon, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-error)' }}>
                        <AlertTriangle size={24} />
                    </div>
                    <div style={styles.kpiInfo}>
                        <span style={styles.kpiLabel}>Total Rejected</span>
                        <h2 style={styles.kpiValue}>{stats.totalRejected || 0}</h2>
                    </div>
                </div>

                <div className="glass-card" style={{ ...styles.kpiCard, borderLeft: '4px solid var(--accent-yellow)' }}>
                    <div style={{ ...styles.kpiIcon, background: 'rgba(250, 204, 21, 0.1)', color: 'var(--accent-yellow)' }}>
                        <Clock size={24} />
                    </div>
                    <div style={styles.kpiInfo}>
                        <span style={styles.kpiLabel}>Avg Handle Time</span>
                        <h2 style={styles.kpiValue}>{formatTime(avgHandleTime)}</h2>
                    </div>
                </div>
            </div>

            {selectedStatus && (
                <section className="glass-card fade-in" style={{ ...styles.sectionCard, marginTop: '2rem', padding: '1.5rem' }}>
                    <div style={{ ...styles.sectionHeader, marginBottom: '1.5rem' }}>
                        <h3 style={styles.sectionTitle}>
                            {selectedStatus} TICKETS EXPLORER
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                            LIVE DATA
                        </div>
                    </div>

                    {isLoadingTickets ? (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: '700' }}>
                            SYNCING ARCHIVE...
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {(ticketsData?.tickets || []).map((t: Ticket) => (
                                    <div key={t.ticketId} style={{
                                        padding: '1rem',
                                        background: 'var(--glass-highlight)',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        border: '1px solid var(--glass-border)'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)' }}>{t.displayId}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.description.substring(0, 60)}...</span>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent-blue)' }}>{new Date(t.issueDateTime).toLocaleDateString()}</span>
                                            <span style={{
                                                fontSize: '0.6rem',
                                                padding: '2px 8px',
                                                borderRadius: '99px',
                                                background: t.status === 'RESOLVED' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                                                color: t.status === 'RESOLVED' ? '#10b981' : 'var(--accent-blue)',
                                                fontWeight: '900'
                                            }}>{t.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {ticketsData && ticketsData.pages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        style={{ ...styles.iconBtn, opacity: page === 1 ? 0.3 : 1 }}
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>{page} / {ticketsData.pages}</span>
                                    <button
                                        onClick={() => setPage(p => Math.min(ticketsData.pages, p + 1))}
                                        disabled={page === ticketsData.pages}
                                        style={{ ...styles.iconBtn, opacity: page === ticketsData.pages ? 0.3 : 1 }}
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </section>
            )}

            <section className="glass-card" style={{ ...styles.sectionCard, marginTop: '2rem' }}>
                <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Performance Trends (Raised vs Resolved)</h3>
                    <BarChart3 size={20} color="var(--accent-blue)" />
                </div>
                <div style={{ padding: '1rem 0' }}>
                    <PerformanceAreaChart data={ticketHistory} />
                </div>
            </section>
        </div>
    );
};

export default MetricsTab;
