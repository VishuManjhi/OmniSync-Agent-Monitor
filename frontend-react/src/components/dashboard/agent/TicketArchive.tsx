import React from 'react';
import { Search } from 'lucide-react';
import { styles } from './agentDashboardStyles';
import type { Ticket } from '../../../api/types';

interface TicketArchiveProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filteredTickets: Ticket[];
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    totalPages: number;
    getAssistedByLabel: (ticket: Ticket) => string;
}

const TicketArchive: React.FC<TicketArchiveProps> = ({
    searchTerm,
    setSearchTerm,
    filteredTickets,
    page,
    setPage,
    totalPages,
    getAssistedByLabel
}) => {
    return (
        <div style={styles.dashboardView} className="fade-in">
            <section className="glass-card" style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>Ticket Archive</h3>
                    <div style={styles.searchBar}>
                        <Search size={16} color="var(--text-muted)" />
                        <input
                            style={styles.lightInput}
                            placeholder="Search by ID or description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--glass-highlight)' }}>
                                <th style={tableStyles.th}>Display ID</th>
                                <th style={tableStyles.th}>Issue Type</th>
                                <th style={tableStyles.th}>Assisted By</th>
                                <th style={tableStyles.th}>Description</th>
                                <th style={tableStyles.th}>Raised</th>
                                <th style={tableStyles.th}>Resolved</th>
                                <th style={tableStyles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTickets.length > 0 ? filteredTickets.map((t: Ticket) => (
                                <tr 
                                    key={t._id} 
                                    style={tableStyles.tr}
                                    onMouseEnter={(e) => {
                                        const target = e.currentTarget as HTMLTableRowElement;
                                        target.style.background = 'rgba(250, 204, 21, 0.05)';
                                        target.style.borderLeft = '3px solid var(--accent-yellow)';
                                    }}
                                    onMouseLeave={(e) => {
                                        const target = e.currentTarget as HTMLTableRowElement;
                                        target.style.background = 'transparent';
                                        target.style.borderLeft = '3px solid transparent';
                                    }}
                                >
                                    <td style={tableStyles.displayIdTd}>{t.displayId || '-'}</td>
                                    <td style={tableStyles.td}>{t.issueType}</td>
                                    <td style={tableStyles.td}>{getAssistedByLabel(t) || '-'}</td>
                                    <td style={{ ...tableStyles.td, maxWidth: '320px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{t.description}</td>
                                    <td style={tableStyles.td}>{new Date(t.issueDateTime).toLocaleString()}</td>
                                    <td style={tableStyles.td}>{t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : '-'}</td>
                                    <td style={tableStyles.td}>
                                        <span style={{
                                            ...styles.rowStatus,
                                            ...styles[`status_${t.status.replace(' ', '_')}` as keyof typeof styles]
                                        }}>
                                            {t.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td style={tableStyles.td} colSpan={7}>No archive records found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div style={styles.lightPagination}>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            style={styles.pagBtn}
                        >
                            Previous
                        </button>
                        <span style={styles.pagInfo}>Page {page} of {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            style={styles.pagBtn}
                        >
                            Next
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
};

const tableStyles: Record<string, React.CSSProperties> = {
    th: {
        textAlign: 'left',
        padding: '1rem 1.2rem',
        color: 'var(--accent-yellow)',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontWeight: 800,
        borderBottom: '2px solid var(--glass-border)',
        background: 'rgba(250, 204, 21, 0.05)'
    },
    td: {
        padding: '1rem 1.2rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        transition: 'all 0.2s ease'
    },
    displayIdTd: {
        padding: '1rem 1.2rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: '0.85rem',
        fontWeight: 700,
        color: 'var(--accent-yellow)',
        borderLeft: '3px solid var(--accent-yellow)',
        backgroundColor: 'rgba(234, 179, 8, 0.08)',
        transition: 'all 0.2s ease'
    },
    tr: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        borderLeft: '3px solid transparent'
    }
};

export default TicketArchive;
