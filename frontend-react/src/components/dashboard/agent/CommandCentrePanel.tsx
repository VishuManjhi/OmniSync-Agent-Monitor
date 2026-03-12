import React from 'react';
import { Play, Square, Coffee, Phone, Plus, Activity, CheckCircle, X } from 'lucide-react';
import { styles } from './agentDashboardStyles';
import type { Ticket } from '../../../api/types';

type TopSolutionOption = {
    rank: number;
    text: string;
    usageCount: number;
    lastUsedAt: number | null;
    source: 'historical' | 'bootstrap' | string;
};

interface CommandCentreProps {
    currentStatus: string;
    handleClockIn: () => void;
    handleClockOut: () => void;
    handleBreakToggle: () => void;
    handleOnCallToggle: () => void;
    issueType: string;
    setIssueType: (val: string) => void;
    description: string;
    setDescription: (val: string) => void;
    callDuration: string;
    setCallDuration: (val: string) => void;
    handleAttachmentChange: (file: File | null) => void;
    attachment: File | null;
    handleTicketSubmit: (e: React.FormEvent) => void;
    ticketMutationPending: boolean;
    filteredTickets: Ticket[];
    emailTickets: Ticket[];
    handleTicketUpdate: (id: string, status: string) => void;
    handleLoadTopSolutions: (ticketId: string) => void;
    topSolutionsByTicket: Record<string, TopSolutionOption[]>;
    loadingTopSolutionsFor: string | null;
    handleApplyTopSolution: (ticketId: string, solution: string) => void;
    getAssistedByLabel: (ticket: Ticket) => string;
    applyTopSolutionPending: boolean;
    topSolutionModalTicketId: string | null;
    closeTopSolutionsModal: () => void;
    onOpenRoom: (ticketId: string) => void;
    isSessionLoading: boolean;
}

const CommandCentrePanel: React.FC<CommandCentreProps> = ({
    currentStatus,
    handleClockIn,
    handleClockOut,
    handleBreakToggle,
    handleOnCallToggle,
    issueType,
    setIssueType,
    description,
    setDescription,
    callDuration,
    setCallDuration,
    handleAttachmentChange,
    attachment,
    handleTicketSubmit,
    ticketMutationPending,
    filteredTickets,
    emailTickets,
    handleTicketUpdate,
    handleLoadTopSolutions,
    topSolutionsByTicket,
    loadingTopSolutionsFor,
    handleApplyTopSolution,
    getAssistedByLabel,
    applyTopSolutionPending,
    topSolutionModalTicketId,
    closeTopSolutionsModal,
    onOpenRoom,
    isSessionLoading
}) => {
    const [queueTab, setQueueTab] = React.useState<'NORMAL' | 'EMAIL'>('NORMAL');
    const shownTickets = queueTab === 'EMAIL' ? emailTickets : filteredTickets;
    const modalTicket = topSolutionModalTicketId ? emailTickets.find((ticket) => ticket.ticketId === topSolutionModalTicketId) || null : null;
    const modalSolutions = topSolutionModalTicketId ? (topSolutionsByTicket[topSolutionModalTicketId] || []) : [];

    return (
        <div style={styles.opsGrid} className="fade-in">
            <div style={styles.opsControls}>
                <section className="glass-card" style={{ ...styles.sectionCard, marginBottom: '2rem' }}>
                    <div style={styles.sectionHeader}><h3 style={styles.sectionTitle}>Session Control</h3></div>
                    <div style={styles.ctrlGrid}>
                        <button onClick={handleClockIn} disabled={currentStatus !== 'OFFLINE'} style={{ ...styles.ctrlBtn, background: currentStatus === 'OFFLINE' ? 'var(--glass-highlight)' : 'var(--bg-deep)', color: currentStatus === 'OFFLINE' ? 'var(--accent-blue)' : 'var(--text-muted)', opacity: isSessionLoading ? 0.6 : 1 }}>
                            <Play size={20} /> Clock In
                        </button>
                        <button onClick={handleClockOut} disabled={currentStatus === 'OFFLINE' || isSessionLoading} style={{ ...styles.ctrlBtn, opacity: isSessionLoading ? 0.6 : 1 }}>
                            <Square size={20} /> Clock Out
                        </button>
                        <button onClick={handleBreakToggle} style={{ ...styles.ctrlBtn, color: currentStatus === 'ON_BREAK' ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
                            <Coffee size={20} /> {currentStatus === 'ON_BREAK' ? 'End Break' : 'Take Break'}
                        </button>
                        <button onClick={handleOnCallToggle} disabled={currentStatus === 'ON_BREAK'} style={{ ...styles.ctrlBtn, color: currentStatus === 'ON_CALL' ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                            <Phone size={20} /> {currentStatus === 'ON_CALL' ? 'End Call' : 'Start Call'}
                        </button>
                    </div>
                </section>

                <section className="glass-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}><h3 style={styles.sectionTitle}>Raise Ticket</h3></div>
                    <form onSubmit={handleTicketSubmit} style={styles.lightForm}>
                        <div style={styles.fieldGroup}>
                            <label style={styles.lightLabel}>Category</label>
                            <select style={styles.lightSelect} value={issueType} onChange={(e) => setIssueType(e.target.value)} required>
                                <option value="">Select Category</option><option value="FOH">Front of House</option><option value="BOH">Back of House</option><option value="KIOSK">KIOSK Terminal</option><option value="other">Other Issue</option>
                            </select>
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.lightLabel}>Description</label>
                            <textarea style={styles.lightTextarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detail the support request..." required />
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.lightLabel}>Call Duration (Minutes)</label>
                            <input type="number" style={styles.lightSelect} value={callDuration} onChange={(e) => setCallDuration(e.target.value)} min={1} required />
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.lightLabel}>Attachment (Images)</label>
                            <input type="file" accept="image/*" style={{ ...styles.lightSelect, padding: '8px' }} onChange={(e) => handleAttachmentChange(e.target.files?.[0] || null)} />
                            {attachment && (<div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '6px 10px', borderRadius: '8px', background: 'var(--glass-highlight)', border: '1px solid var(--glass-border)' }}><span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', fontWeight: 700 }}>{attachment.name}</span><button type="button" onClick={() => handleAttachmentChange(null)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}><X size={12} /></button></div>)}
                        </div>
                        <button type="submit" style={styles.primaryBtn} disabled={ticketMutationPending || currentStatus === 'OFFLINE'}><Plus size={18} /> {ticketMutationPending ? 'PROCESSING...' : 'SUBMIT TICKET'}</button>
                    </form>
                </section>
            </div>

            <section className="glass-card" style={{ ...styles.sectionCard, display: 'flex', flexDirection: 'column' }}>
                <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Active Queue</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => setQueueTab('NORMAL')} style={{ ...styles.qBtn, ...(queueTab === 'NORMAL' ? { border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' } : {}) }}>Tickets ({filteredTickets.length})</button>
                        <button onClick={() => setQueueTab('EMAIL')} style={{ ...styles.qBtn, ...(queueTab === 'EMAIL' ? { border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' } : {}) }}>Email Tickets ({emailTickets.length})</button>
                    </div>
                </div>
                <div style={styles.queueScroll}>
                    {shownTickets.length > 0 ? shownTickets.map((t: Ticket) => {
                        const solutions = topSolutionsByTicket[t.ticketId] || [];
                        const isEmailTicket = queueTab === 'EMAIL';
                        return (
                            <div key={t._id} style={styles.queueCard}>
                                <div style={styles.qHeader}>
                                    <span style={styles.qId}>{t.displayId || `#${t.ticketId.substring(0, 8).toUpperCase()}`}</span>
                                    <span style={{ ...styles.qTag, ...styles[`status_${t.status.replace(' ', '_')}` as keyof typeof styles] }}>{t.status}</span>
                                </div>
                                {isEmailTicket && t.emailMeta?.subject && (
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        {t.emailMeta.subject}
                                    </div>
                                )}
                                <p style={styles.qDesc}>{t.description}</p>
                                {isEmailTicket && t.emailMeta?.customerEmail && (
                                    <div style={{ ...styles.rowFooter, marginBottom: '8px', fontSize: '0.75rem' }}>
                                        📧 {t.emailMeta.customerEmail}
                                    </div>
                                )}
                                {getAssistedByLabel(t) && (
                                    <div style={{ ...styles.rowFooter, marginBottom: '8px' }}>
                                        Assisted by {getAssistedByLabel(t)}
                                    </div>
                                )}
                                <div style={styles.qActions}>
                                    {t.status === 'ASSIGNED' && <button onClick={() => handleTicketUpdate(t.ticketId, 'IN_PROGRESS')} style={styles.qBtn}>{queueTab === 'EMAIL' ? 'Accept Ticket' : 'Accept Task'}</button>}
                                    {queueTab === 'EMAIL' && <button onClick={() => handleLoadTopSolutions(t.ticketId)} style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' }} disabled={loadingTopSolutionsFor === t.ticketId}>{loadingTopSolutionsFor === t.ticketId ? 'Loading...' : 'Top 3 Solutions'}</button>}
                                    <button onClick={() => onOpenRoom(t.ticketId)} style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' }}>Open Room</button>
                                    {t.status === 'IN_PROGRESS' && t.assignedBy === 'SUPERVISOR' && <button onClick={() => handleTicketUpdate(t.ticketId, 'RESOLUTION_REQUESTED')} style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' }}>Request Resolution</button>}
                                    {t.status === 'IN_PROGRESS' && t.assignedBy !== 'SUPERVISOR' && <button onClick={() => handleTicketUpdate(t.ticketId, 'RESOLVED')} style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' }}>Resolve</button>}
                                    {t.status === 'RESOLUTION_REQUESTED' && <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={14} className="spin" /> VERIFYING...</div>}
                                </div>
                                {queueTab === 'EMAIL' && solutions.length > 0 && <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--accent-yellow)', fontWeight: 700 }}>Top solutions ready • click button to review</div>}
                            </div>
                        );
                    }) : <div style={styles.emptyView}><CheckCircle size={48} color="var(--text-muted)" /><span>{queueTab === 'EMAIL' ? 'No email tickets in queue' : 'Queue is currently clear'}</span></div>}
                </div>
            </section>

            {modalTicket && (
                <div style={styles.solutionModalOverlay}>
                    <div style={styles.solutionModalCard}>
                        <div style={styles.sectionHeader}>
                            <div>
                                <h3 style={styles.sectionTitle}>Top 3 Solutions</h3>
                                <div style={styles.rowFooter}>
                                    {modalTicket.displayId || modalTicket.ticketId} • {modalTicket.emailMeta?.customerEmail || 'No customer email'}
                                </div>
                            </div>
                            <button onClick={closeTopSolutionsModal} style={{ ...styles.qBtn, maxWidth: '100px', border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' }}>
                                Close
                            </button>
                        </div>
                        <div style={{ ...styles.rowFooter, marginBottom: '12px' }}>
                            Subject: {modalTicket.emailMeta?.subject || 'No subject'}
                        </div>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {modalSolutions.map((solution) => (
                                <div key={`${modalTicket.ticketId}-${solution.rank}`} style={styles.solutionCard}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                                        <strong style={{ color: 'var(--accent-yellow)' }}>Option {solution.rank}</strong>
                                        <span style={{ ...styles.solutionSourceBadge, color: 'var(--accent-yellow)', borderColor: 'var(--accent-yellow)' }}>
                                            {solution.source === 'historical' ? `Historical • ${solution.usageCount}x` : 'Bootstrap'}
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{solution.text}</div>
                                    <button
                                        onClick={() => handleApplyTopSolution(modalTicket.ticketId, solution.text)}
                                        style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' }}
                                        disabled={applyTopSolutionPending}
                                    >
                                        Send this solution
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default CommandCentrePanel;
