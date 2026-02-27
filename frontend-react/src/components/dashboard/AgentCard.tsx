import React from 'react';
import { ShieldOff, Clock } from 'lucide-react';
import type { Agent, AgentSession } from '../../api/types';
import { styles } from './dashboardStyles';
import { deriveAgentStatus } from './utils';

export const AgentCard: React.FC<{
    agent: Agent,
    session?: AgentSession,
    cardIndex: number,
    onForceLogout: (id: string) => void,
    onClick: () => void,
    onOpenReport: (agentId: string) => void
}> = ({ agent, session, onForceLogout, onClick, onOpenReport }) => {
    const status = deriveAgentStatus(session);
    const statusColor = status === 'OFFLINE' ? 'var(--text-muted)' :
        status === 'ON_CALL' ? 'var(--accent-blue)' :
            status === 'ON_BREAK' ? 'var(--accent-yellow)' : '#10b981';

    const cardStyle: React.CSSProperties = {
        ...styles.agentCard,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)',
        boxShadow: 'var(--shadow-premium)',
        position: 'relative',
        overflow: 'hidden',
    };

    return (
        <div className="glass-card" style={cardStyle} onClick={onClick}>
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: 'linear-gradient(90deg, transparent, var(--accent-blue), transparent)',
                opacity: 0.35,
            }} />
            <div style={styles.agentHeader}>
                <div style={styles.agentInfo}>
                    <h3 style={{ ...styles.agentName, color: 'var(--text-primary)' }}>{agent.name}</h3>
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
                    <div style={{ ...styles.statusDot, background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
                </div>
            </div>

            <div style={{ ...styles.cardContent, minHeight: '92px' }}>
                <div style={{ ...styles.statusLabel, color: statusColor }}>
                    <Clock size={14} style={{ marginRight: '4px' }} />
                    {status}
                </div>
                {status === 'OFFLINE' && session?.clockOutTime && (
                    <div style={{ ...styles.statusLabel, marginTop: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Out: {new Date(session.clockOutTime).toLocaleTimeString()}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '10px' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenReport(agent.agentId);
                        }}
                        style={{
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            background: 'var(--glass-highlight)',
                            color: 'var(--text-primary)',
                            padding: '6px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        Open Report
                    </button>
                </div>
            </div>
        </div>
    );
};
