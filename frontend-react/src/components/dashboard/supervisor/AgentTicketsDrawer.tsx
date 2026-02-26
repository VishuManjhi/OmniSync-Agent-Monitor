import React from 'react';
import type { Agent, AgentSession, Ticket } from '../../../api/types';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface AgentTicketsDrawerProps {
    open: boolean;
    agent: Agent | null;
    session?: AgentSession;
    tickets: Ticket[];
    page: number;
    totalPages: number;
    isLoading: boolean;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onTicketClick: (ticket: Ticket) => void;
}

const deriveStatus = (session?: AgentSession) => {
    if (!session || session.clockOutTime) return 'OFFLINE';
    const hasOpenBreak = session.breaks?.some(b => !b.breakOut);
    if (hasOpenBreak) return 'ON_BREAK';
    if (session.onCall) return 'ON_CALL';
    return 'ACTIVE';
};

const AgentTicketsDrawer: React.FC<AgentTicketsDrawerProps> = ({
    open,
    agent,
    session,
    tickets,
    page,
    totalPages,
    isLoading,
    onClose,
    onPrev,
    onNext,
    onTicketClick
}) => {
    if (!open || !agent) return null;

    const status = deriveStatus(session);

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(2, 6, 23, 0.45)',
                    zIndex: 70
                }}
            />
            <aside style={{
                position: 'fixed',
                right: 0,
                top: 0,
                width: '420px',
                height: '100vh',
                background: 'var(--bg-card)',
                borderLeft: '1px solid var(--glass-border)',
                zIndex: 71,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-premium)'
            }}>
                <div style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{agent.name}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>{agent.agentId} • {status}</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {isLoading ? (
                        <div style={{ color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', paddingTop: '2rem' }}>LOADING TICKETS...</div>
                    ) : tickets.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', paddingTop: '2rem' }}>NO TICKETS FOUND</div>
                    ) : (
                        tickets.map(ticket => (
                            <div
                                key={ticket.ticketId}
                                onClick={() => onTicketClick(ticket)}
                                style={{
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '10px',
                                    padding: '0.8rem',
                                    background: 'var(--glass-highlight)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-blue)' }}>{ticket.displayId || ticket.ticketId.slice(0, 8)}</span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)' }}>{ticket.status}</span>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{ticket.description}</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>{new Date(ticket.issueDateTime).toLocaleString()}</span>
                            </div>
                        ))
                    )}
                </div>

                <div style={{
                    padding: '0.9rem 1rem',
                    borderTop: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <button
                        onClick={onPrev}
                        disabled={page <= 1}
                        style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', borderRadius: '8px', padding: '6px', opacity: page <= 1 ? 0.4 : 1 }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{page} / {Math.max(totalPages, 1)}</span>
                    <button
                        onClick={onNext}
                        disabled={page >= Math.max(totalPages, 1)}
                        style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', borderRadius: '8px', padding: '6px', opacity: page >= Math.max(totalPages, 1) ? 0.4 : 1 }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </aside>
        </>
    );
};

export default AgentTicketsDrawer;
