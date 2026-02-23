import React from 'react';
import { X } from 'lucide-react';
import type { Agent, AgentSession } from '../../api/types';
import { styles } from './dashboardStyles';
import { deriveAgentStatus } from './utils';

export const AgentDetailsModal: React.FC<{
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
