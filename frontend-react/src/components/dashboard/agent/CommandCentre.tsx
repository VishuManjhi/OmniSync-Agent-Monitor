import React from 'react';
import { Play, Square, Coffee, Phone, Plus, Activity, CheckCircle } from 'lucide-react';
import { styles } from './agentDashboardStyles';
import type { Ticket } from '../../../api/types';

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
    handleTicketUpdate: (id: string, status: string) => void;
    isSessionLoading: boolean;
}

const CommandCentre: React.FC<CommandCentreProps> = ({
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
    handleTicketUpdate,
    isSessionLoading
}) => {
    return (
        <div style={styles.opsGrid} className="fade-in">
            <div style={styles.opsControls}>
                <section className="glass-card" style={{ ...styles.sectionCard, marginBottom: '2rem' }}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Session Control</h3>
                    </div>
                    <div style={styles.ctrlGrid}>
                        <button
                            onClick={handleClockIn}
                            disabled={currentStatus !== 'OFFLINE'}
                            style={{
                                ...styles.ctrlBtn,
                                background: currentStatus === 'OFFLINE' ? 'var(--glass-highlight)' : 'var(--bg-deep)',
                                color: currentStatus === 'OFFLINE' ? 'var(--accent-blue)' : 'var(--text-muted)',
                                opacity: isSessionLoading ? 0.6 : 1
                            }}
                        >
                            <Play size={20} className={isSessionLoading && currentStatus === 'OFFLINE' ? 'spin' : ''} /> {isSessionLoading && currentStatus === 'OFFLINE' ? 'SYNCING...' : 'Clock In'}
                        </button>
                        <button
                            onClick={handleClockOut}
                            disabled={currentStatus === 'OFFLINE' || isSessionLoading}
                            style={{ ...styles.ctrlBtn, opacity: isSessionLoading ? 0.6 : 1 }}
                        >
                            <Square size={20} className={isSessionLoading && currentStatus !== 'OFFLINE' && currentStatus !== 'ON_BREAK' && currentStatus !== 'ON_CALL' ? 'spin' : ''} />
                            {isSessionLoading && currentStatus !== 'OFFLINE' && currentStatus !== 'ON_BREAK' && currentStatus !== 'ON_CALL' ? 'SYNCING...' : 'Clock Out'}
                        </button>
                        <button
                            onClick={handleBreakToggle}
                            style={{
                                ...styles.ctrlBtn,
                                color: currentStatus === 'ON_BREAK' ? 'var(--accent-yellow)' : 'var(--text-muted)'
                            }}
                        >
                            <Coffee size={20} /> {currentStatus === 'ON_BREAK' ? 'End Break' : 'Take Break'}
                        </button>
                        <button
                            onClick={handleOnCallToggle}
                            disabled={currentStatus === 'ON_BREAK'}
                            style={{
                                ...styles.ctrlBtn,
                                color: currentStatus === 'ON_CALL' ? 'var(--accent-blue)' : 'var(--text-muted)'
                            }}
                        >
                            <Phone size={20} /> {currentStatus === 'ON_CALL' ? 'End Call' : 'Start Call'}
                        </button>
                    </div>
                </section>

                <section className="glass-card" style={styles.sectionCard}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>Raise Ticket</h3>
                    </div>
                    <form onSubmit={handleTicketSubmit} style={styles.lightForm}>
                        <div style={styles.fieldGroup}>
                            <label style={styles.lightLabel}>Category</label>
                            <select
                                style={styles.lightSelect}
                                value={issueType}
                                onChange={(e) => setIssueType(e.target.value)}
                                required
                            >
                                <option value="">Select Category</option>
                                <option value="FOH">Front of House</option>
                                <option value="BOH">Back of House</option>
                                <option value="KIOSK">KIOSK Terminal</option>
                                <option value="other">Other Issue</option>
                            </select>
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.lightLabel}>Description</label>
                            <textarea
                                style={styles.lightTextarea}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detail the support request..."
                                required
                            />
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.lightLabel}>Call Duration (Minutes)</label>
                            <input
                                type="number"
                                style={styles.lightSelect}
                                value={callDuration}
                                onChange={(e) => setCallDuration(e.target.value)}
                                placeholder="Enter minutes..."
                            />
                        </div>
                        <div style={styles.fieldGroup}>
                            <label style={styles.lightLabel}>Attachment (Images)</label>
                            <input
                                type="file"
                                accept="image/*"
                                style={{ ...styles.lightSelect, padding: '8px' }}
                                onChange={(e) => handleAttachmentChange(e.target.files?.[0] || null)}
                            />
                            {attachment && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--accent-blue)' }}>
                                    Selected: {attachment.name}
                                </span>
                            )}
                        </div>
                        <button
                            type="submit"
                            style={styles.primaryBtn}
                            disabled={ticketMutationPending || currentStatus === 'OFFLINE'}
                        >
                            <Plus size={18} /> {ticketMutationPending ? 'PROCESSING...' : 'SUBMIT TICKET'}
                        </button>
                    </form>
                </section>
            </div>

            <section className="glass-card" style={{ ...styles.sectionCard, display: 'flex', flexDirection: 'column' }}>
                <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Active Queue</h3>
                    <span style={styles.queueCount}>{filteredTickets.length} Pending</span>
                </div>
                <div style={styles.queueScroll}>
                    {filteredTickets.length > 0 ? (
                        filteredTickets.map((t: Ticket) => (
                            <div key={t._id} style={styles.queueCard}>
                                <div style={styles.qHeader}>
                                    <span style={styles.qId}>
                                        {t.displayId || `#${t.ticketId.substring(0, 8).toUpperCase()}`}
                                    </span>
                                    <span style={{
                                        ...styles.qTag,
                                        ...styles[`status_${t.status.replace(' ', '_')}` as keyof typeof styles]
                                    }}>
                                        {t.status}
                                    </span>
                                </div>
                                <p style={styles.qDesc}>{t.description}</p>
                                <div style={styles.qActions}>
                                    {t.status === 'ASSIGNED' && (
                                        <button
                                            onClick={() => handleTicketUpdate(t._id, 'IN_PROGRESS')}
                                            style={styles.qBtn}
                                        >
                                            Accept Task
                                        </button>
                                    )}
                                    {t.status === 'IN_PROGRESS' && t.assignedBy === 'SUPERVISOR' && (
                                        <button
                                            onClick={() => handleTicketUpdate(t._id, 'RESOLUTION_REQUESTED')}
                                            style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' }}
                                        >
                                            Request Resolution
                                        </button>
                                    )}
                                    {t.status === 'IN_PROGRESS' && t.assignedBy !== 'SUPERVISOR' && (
                                        <button
                                            onClick={() => handleTicketUpdate(t._id, 'RESOLVED')}
                                            style={{ ...styles.qBtn, border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)' }}
                                        >
                                            Resolve
                                        </button>
                                    )}
                                    {t.status === 'RESOLUTION_REQUESTED' && (
                                        <div style={{
                                            fontSize: '0.75rem',
                                            fontWeight: '800',
                                            color: 'var(--accent-yellow)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <Activity size={14} className="spin" /> VERIFYING...
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={styles.emptyView}>
                            <CheckCircle size={48} color="var(--text-muted)" />
                            <span>Queue is currently clear</span>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default CommandCentre;
