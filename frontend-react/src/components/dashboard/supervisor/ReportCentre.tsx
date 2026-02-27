import React, { useMemo, useState } from 'react';
import type { Agent, AgentSession } from '../../../api/types';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchAgentReport, exportAgentReport, emailAgentReport, updateAgentEmail } from '../../../api/agent';
import { useNotification } from '../../../context/NotificationContext';

type Period = 'weekly' | 'monthly';

interface ReportCentreProps {
    agents: Agent[];
    sessions: AgentSession[];
    preselectedAgentId?: string | null;
    onJobTriggered?: () => void;
}

const deriveAgentStatus = (session?: AgentSession) => {
    if (!session || session.clockOutTime) return 'OFFLINE';
    if (session.breaks?.some(b => !b.breakOut)) return 'ON_BREAK';
    if (session.onCall) return 'ON_CALL';
    return 'ACTIVE';
};

const formatAHT = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ReportCentre: React.FC<ReportCentreProps> = ({ agents, sessions, preselectedAgentId, onJobTriggered }) => {
    const initialPreselectedAgent = preselectedAgentId
        ? agents.find(a => a.agentId === preselectedAgentId) || null
        : null;

    const [search, setSearch] = useState(initialPreselectedAgent?.name || initialPreselectedAgent?.agentId || '');
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(initialPreselectedAgent?.agentId || null);
    const [period, setPeriod] = useState<Period>('weekly');
    const [editableEmail, setEditableEmail] = useState(initialPreselectedAgent?.email || '');
    const { showNotification } = useNotification();

    const filteredAgents = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return agents.filter(agent =>
            agent.name.toLowerCase().includes(q) ||
            agent.agentId.toLowerCase().includes(q)
        );
    }, [agents, search]);

    const selectedAgent = selectedAgentId
        ? agents.find(a => a.agentId === selectedAgentId) || null
        : null;

    const selectAgent = (agentId: string) => {
        const agent = agents.find(a => a.agentId === agentId);
        setSelectedAgentId(agentId);
        setEditableEmail(agent?.email || '');
    };

    const { data: report, isLoading: isLoadingReport, refetch: refetchReport } = useQuery({
        queryKey: ['agent-report', selectedAgentId, period],
        queryFn: () => fetchAgentReport(selectedAgentId!, period),
        enabled: !!selectedAgentId
    });

    const emailReportMutation = useMutation({
        mutationFn: () => emailAgentReport(selectedAgentId!, period),
        onSuccess: (res) => {
            showNotification(`Report mailed to ${res.sentTo}`, 'success', 'REPORT SENT');
            onJobTriggered?.();
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Failed to send report';
            showNotification(message, 'error', 'REPORT ERROR');
        }
    });

    const saveEmailMutation = useMutation({
        mutationFn: () => updateAgentEmail(selectedAgentId!, editableEmail),
        onSuccess: () => {
            showNotification('Agent email updated successfully', 'success', 'EMAIL UPDATED');
            refetchReport();
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Failed to update email';
            showNotification(message, 'error', 'EMAIL ERROR');
        }
    });

    const handleExport = async () => {
        if (!selectedAgentId) return;
        try {
            const blob = await exportAgentReport(selectedAgentId, period);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${selectedAgentId}-${period}-report.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
            showNotification('Excel report generated', 'success', 'REPORT READY');
            onJobTriggered?.();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to export report';
            showNotification(message, 'error', 'REPORT ERROR');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <section className="glass-card" style={{ padding: '1rem 1.25rem', borderRadius: '14px' }}>
                <input
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setSelectedAgentId(null);
                    }}
                    placeholder="Search for any agent by name or ID"
                    style={{
                        width: '100%',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontWeight: 600
                    }}
                />
            </section>

            {!search.trim() && !selectedAgent ? (
                <section className="glass-card" style={{ padding: '2.2rem', borderRadius: '14px', textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Search for any agent</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Use the search box above to find an agent and generate report insights.</p>
                </section>
            ) : (
                <>
                    {selectedAgent ? (
                        <section className="glass-card" style={{ padding: '1rem', borderRadius: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedAgent.name}</h3>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{selectedAgent.agentId}</span>
                                </div>
                                <select
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value as Period)}
                                    style={{
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        background: 'var(--bg-card)',
                                        color: 'var(--text-primary)',
                                        padding: '8px 10px'
                                    }}
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                                marginBottom: '1rem',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '10px',
                                padding: '0.75rem',
                                background: 'var(--glass-highlight)'
                            }}>
                                <input
                                    value={editableEmail}
                                    onChange={(e) => setEditableEmail(e.target.value)}
                                    placeholder="Agent email address"
                                    style={{
                                        flex: 1,
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        padding: '8px 10px',
                                        background: 'var(--bg-card)',
                                        color: 'var(--text-primary)',
                                        fontWeight: 600
                                    }}
                                />
                                <button
                                    onClick={() => saveEmailMutation.mutate()}
                                    disabled={saveEmailMutation.isPending || !editableEmail.trim()}
                                    style={{
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: 'var(--accent-blue)',
                                        color: '#fff',
                                        padding: '8px 12px',
                                        fontWeight: 700,
                                        opacity: saveEmailMutation.isPending || !editableEmail.trim() ? 0.6 : 1
                                    }}
                                >
                                    {saveEmailMutation.isPending ? 'Saving...' : 'Save Email'}
                                </button>
                            </div>

                            {isLoadingReport ? (
                                <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Loading report...</div>
                            ) : report ? (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem' }}>
                                        {[
                                            { label: 'Total Raised', value: report.metrics.totalRaised },
                                            { label: 'Total Resolved', value: report.metrics.totalResolved },
                                            { label: 'Total Rejected', value: report.metrics.totalRejected },
                                            { label: 'Attendance (Hours)', value: report.metrics.attendanceHours },
                                            { label: 'AHT', value: formatAHT(report.metrics.avgHandleTimeSeconds) },
                                            { label: 'SLA %', value: `${report.metrics.slaPercent}%` },
                                            { label: 'Live Status', value: report.agent.status },
                                            { label: 'Email', value: report.agent.email || 'Not configured' },
                                            { label: 'Range', value: `${new Date(report.from).toLocaleDateString()} - ${new Date(report.to).toLocaleDateString()}` }
                                        ].map(item => (
                                            <div key={item.label} style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.75rem', background: 'var(--glass-highlight)' }}>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700 }}>{item.label}</div>
                                                <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 800 }}>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{
                                        marginTop: '1rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '10px',
                                        padding: '0.75rem',
                                        background: 'var(--glass-highlight)'
                                    }}>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>
                                            Report actions
                                        </span>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button onClick={handleExport} style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '8px 10px', fontWeight: 700 }}>
                                                Generate Excel
                                            </button>
                                            <button
                                                onClick={() => emailReportMutation.mutate()}
                                                disabled={emailReportMutation.isPending}
                                                style={{ border: 'none', borderRadius: '8px', background: 'var(--accent-blue)', color: '#fff', padding: '8px 10px', fontWeight: 700, opacity: emailReportMutation.isPending ? 0.65 : 1 }}
                                            >
                                                {emailReportMutation.isPending ? 'Sending...' : 'Mail to Agent'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </section>
                    ) : (
                        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.8rem' }}>
                            {filteredAgents.map(agent => {
                                const session = sessions.find(s => s.agentId === agent.agentId);
                                const liveStatus = deriveAgentStatus(session);
                                return (
                                    <button
                                        key={agent.agentId}
                                        onClick={() => selectAgent(agent.agentId)}
                                        className="glass-card"
                                        style={{
                                            textAlign: 'left',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '12px',
                                            padding: '0.9rem',
                                            background: 'var(--glass-bg)'
                                        }}
                                    >
                                        <div style={{ color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 800 }}>{agent.name}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 }}>{agent.agentId}</div>
                                        <div style={{ marginTop: '0.5rem', color: 'var(--accent-blue)', fontSize: '0.72rem', fontWeight: 800 }}>{liveStatus}</div>
                                    </button>
                                );
                            })}
                            {filteredAgents.length === 0 && (
                                <div className="glass-card" style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                    No matching agents found.
                                </div>
                            )}
                        </section>
                    )}
                </>
            )}
        </div>
    );
};

export default ReportCentre;
