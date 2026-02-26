import React from 'react';
import { Activity, CheckCircle, Clock, Coffee } from 'lucide-react';
import { BarChart, PieChart, AreaChart } from '../../analytics/PerformanceCharts';
import { styles } from './agentDashboardStyles';

interface DashboardOverviewProps {
    kpis: Array<{
        label: string;
        value: string | number;
        icon: React.ReactNode;
        color: string;
        bg: string;
    }>;
    agentAnalytics: any;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ kpis, agentAnalytics }) => {
    return (
        <div style={styles.dashboardView} className="fade-in">
            {/* Dashboard Hero: Primary Stats */}
            <div style={styles.statsHero}>
                {kpis.map((k, i) => (
                    <div key={i} className="glass-card" style={{ ...styles.heroCard, borderLeft: `4px solid ${k.color}` }}>
                        <div style={{ ...styles.heroIcon, background: k.bg, color: k.color }}>{k.icon}</div>
                        <div style={styles.heroText}>
                            <span style={styles.heroLabel}>{k.label}</span>
                            <span style={styles.heroValue}>{k.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div style={styles.dashboardGrid}>
                {/* Main Performance Column */}
                <div style={styles.mainMetricsCol}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <section className="glass-card" style={styles.sectionCard}>
                            <div style={styles.sectionHeader}>
                                <h3 style={styles.sectionTitle}>Daily Performance</h3>
                                <Activity size={16} color="var(--text-muted)" />
                            </div>
                            <BarChart data={agentAnalytics?.ticketHistory || []} />
                        </section>

                        <section className="glass-card" style={styles.sectionCard}>
                            <div style={styles.sectionHeader}>
                                <h3 style={styles.sectionTitle}>Resolution Ratio</h3>
                                <CheckCircle size={16} color="var(--text-muted)" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                                <PieChart ratio={agentAnalytics?.overallRatio || { totalRaised: 0, totalResolved: 0 }} />
                            </div>
                        </section>
                    </div>

                    <section className="glass-card" style={{ ...styles.sectionCard, marginTop: '1.5rem' }}>
                        <div style={styles.sectionHeader}>
                            <h3 style={styles.sectionTitle}>System Online Trends (Hours)</h3>
                            <Clock size={16} color="var(--text-muted)" />
                        </div>
                        <AreaChart data={agentAnalytics?.sessionHistory || []} />
                    </section>
                </div>

                {/* Sidebar Column: Break History */}
                <div style={styles.sidebarCol}>
                    <section className="glass-card" style={{ ...styles.sectionCard, height: '100%' }}>
                        <div style={styles.sectionHeader}>
                            <h3 style={styles.sectionTitle}>Recent Breaks</h3>
                            <Coffee size={16} color="var(--text-muted)" />
                        </div>
                        <div style={styles.breakList}>
                            {agentAnalytics?.breakHistory && agentAnalytics.breakHistory.length > 0 ? (
                                agentAnalytics.breakHistory.slice(-5).reverse().map((b: any, i: number) => (
                                    <div key={i} style={styles.breakRow}>
                                        <div style={styles.breakTimeInfo}>
                                            <span style={styles.breakTimeLabel}>
                                                {new Date(b.breakIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {b.breakOut && (
                                                <span style={styles.breakDuration}>
                                                    ({Math.floor((b.breakOut - b.breakIn) / 60000)}m)
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ ...styles.statusDot, background: b.breakOut ? '#e2e8f0' : '#f59e0b' }} />
                                    </div>
                                ))
                            ) : (
                                <div style={styles.emptyActivity}>
                                    <Coffee size={32} color="#f1f5f9" />
                                    <span>No breaks today</span>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
