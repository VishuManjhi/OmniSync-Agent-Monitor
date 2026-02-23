import React, { useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import type { Ticket } from '../../api/types';
import { styles } from './dashboardStyles';
import Modal from '../ui/Modal';

export const TicketModal: React.FC<{
    ticket: Ticket,
    onClose: () => void,
    onUpdate: (updates: Partial<Ticket>) => void,
    onReject: (reason: string) => void,
    isLoading?: boolean
}> = ({ ticket, onClose, onUpdate, onReject, isLoading }) => {
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleApprove = () => {
        onUpdate({ status: 'RESOLVED', resolvedAt: Date.now() });
    };

    const handleRejectSubmit = () => {
        if (!rejectionReason.trim()) return;
        onReject(rejectionReason);
    };

    const footer = (
        <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
            {!isRejecting ? (
                <>
                    {(ticket.status === 'RESOLUTION_REQUESTED' || ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') && (
                        <>
                            <button
                                style={{ ...styles.resolveBtn, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                                onClick={handleApprove}
                                disabled={isLoading}
                            >
                                <CheckCircle size={16} /> {isLoading ? 'APPROVING...' : 'APPROVE'}
                            </button>
                            <button
                                style={{ ...styles.rejectBtn, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                                onClick={() => setIsRejecting(true)}
                                disabled={isLoading}
                            >
                                <X size={16} /> REJECT
                            </button>
                        </>
                    )}
                    <button style={styles.closeBtn} onClick={onClose} disabled={isLoading}>CLOSE</button>
                </>
            ) : (
                <>
                    <button
                        style={{ ...styles.rejectBtn, background: '#ef4444', color: 'white', cursor: isLoading ? 'not-allowed' : 'pointer' }}
                        onClick={handleRejectSubmit}
                        disabled={isLoading || !rejectionReason.trim()}
                    >
                        {isLoading ? 'REJECTING...' : 'CONFIRM REJECTION'}
                    </button>
                    <button
                        style={styles.closeBtn}
                        onClick={() => { setIsRejecting(false); setRejectionReason(''); }}
                        disabled={isLoading}
                    >
                        CANCEL
                    </button>
                </>
            )}
        </div>
    );

    return (
        <Modal open={true} onOpenChange={(v) => { if (!v && !isLoading) onClose(); }} title={isRejecting ? "REJECT TICKET" : "TICKET DETAILS"} footer={footer}>
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
                        {ticket.attachments && ticket.attachments.length > 0 && (
                            <div style={styles.detailItem}>
                                <span style={styles.detailLabel}>ATTACHMENTS ({ticket.attachments.length})</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                    {ticket.attachments.map((att, idx) => (
                                        <div key={att.attachmentId || idx} style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--glass-border)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'white', wordBreak: 'break-all' }}>{att.fileName}</span>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                    {(att.size / 1024).toFixed(1)} KB
                                                </span>
                                            </div>
                                            {att.type.startsWith('image/') && att.content && (
                                                <img
                                                    src={`data:${att.type};base64,${att.content}`}
                                                    alt={att.fileName}
                                                    style={{
                                                        maxHeight: '120px',
                                                        maxWidth: '220px',
                                                        objectFit: 'cover',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--glass-border)',
                                                        cursor: 'zoom-in'
                                                    }}
                                                    onClick={() => {
                                                        const win = window.open();
                                                        win?.document.write(`
                                                            <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;">
                                                                <img src="data:${att.type};base64,${att.content}" style="max-width:100%;max-height:100%;"/>
                                                            </body>
                                                        `);
                                                    }}
                                                />
                                            )}
                                            <button
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = `data:${att.type};base64,${att.content}`;
                                                    link.download = att.fileName;
                                                    link.click();
                                                }}
                                                style={{
                                                    background: 'var(--accent-blue)',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '4px 12px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    width: 'fit-content'
                                                }}
                                            >
                                                DOWNLOAD
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
