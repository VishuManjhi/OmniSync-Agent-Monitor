import React from 'react';
import { Search, Inbox, Clock, CheckCircle } from 'lucide-react';
import { styles } from './agentDashboardStyles';
import type { Ticket } from '../../../api/types';

interface TicketArchiveProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filteredTickets: Ticket[];
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    totalPages: number;
}

const TicketArchive: React.FC<TicketArchiveProps> = ({
    searchTerm,
    setSearchTerm,
    filteredTickets,
    page,
    setPage,
    totalPages
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

                <div style={styles.ticketTable}>
                    {filteredTickets.length > 0 ? (
                        filteredTickets.map((t: Ticket) => (
                            <div key={t._id} style={styles.tableRow}>
                                <div style={styles.rowMain}>
                                    <div style={styles.rowHeader}>
                                        <span style={styles.rowId}>
                                            {t.displayId || `#${t.ticketId.substring(0, 8).toUpperCase()}`}
                                        </span>
                                        <span style={styles.rowType}>{t.issueType}</span>
                                        <span style={{
                                            ...styles.rowStatus,
                                            ...styles[`status_${t.status.replace(' ', '_')}` as keyof typeof styles]
                                        }}>
                                            {t.status}
                                        </span>
                                    </div>
                                    <p style={styles.rowDesc}>{t.description}</p>
                                    <div style={styles.rowFooter}>
                                        <Clock size={14} /> {new Date(t.issueDateTime).toLocaleString()}
                                        {t.resolvedAt && (
                                            <>
                                                <div style={{
                                                    width: 4,
                                                    height: 4,
                                                    borderRadius: '50%',
                                                    background: 'var(--glass-border)',
                                                    margin: '0 8px'
                                                }} />
                                                <CheckCircle size={14} /> Resolved: {new Date(t.resolvedAt).toLocaleTimeString()}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={styles.emptyView}>
                            <Inbox size={48} />
                            <span>No archive records found</span>
                        </div>
                    )}
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

export default TicketArchive;
