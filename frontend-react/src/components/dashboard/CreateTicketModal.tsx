import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Agent } from '../../api/types';
import { styles } from './dashboardStyles';

export const CreateTicketModal: React.FC<{
    agents: Agent[],
    onClose: () => void,
    onSubmit: (data: { agentId: string, issueType: string, description: string }) => void,
    isLoading?: boolean
}> = ({ agents, onClose, onSubmit, isLoading }) => {
    const [form, setForm] = useState({ agentId: '', issueType: '', description: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const filteredAgents = agents.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.agentId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAgentSelect = (agent: Agent) => {
        setForm({ ...form, agentId: agent.agentId });
        setSearchTerm(`${agent.name} (${agent.agentId})`);
        setIsDropdownOpen(false);
    };

    const handleFormSubmit = () => {
        if (!form.issueType || !form.description) return;
        onSubmit(form);
    };

    return (
        <div style={styles.modalOverlay}>
            <div className="glass-card" style={styles.modal}>
                <div style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>CREATE TICKET</h3>
                    <button onClick={onClose} style={styles.iconBtn} disabled={isLoading}><X size={20} /></button>
                </div>
                <div style={styles.modalContent}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>AGENT (OPTIONAL)</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                style={styles.input}
                                placeholder="Search agent name or ID..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                disabled={isLoading}
                            />
                            {isDropdownOpen && filteredAgents.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                    background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
                                    borderRadius: '8px', zIndex: 10, maxHeight: '150px', overflowY: 'auto'
                                }}>
                                    {filteredAgents.map(a => (
                                        <div
                                            key={a.agentId}
                                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)' }}
                                            onClick={() => handleAgentSelect(a)}
                                        >
                                            {a.name} ({a.agentId})
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>ISSUE TYPE</label>
                        <select
                            style={styles.input}
                            value={form.issueType}
                            onChange={(e) => setForm({ ...form, issueType: e.target.value })}
                            disabled={isLoading}
                        >
                            <option value="">Select Tier</option>
                            <option value="FOH">FOH</option>
                            <option value="BOH">BOH</option>
                            <option value="KIOSK">KIOSK</option>
                        </select>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>DESCRIPTION</label>
                        <textarea
                            style={{ ...styles.input, height: '80px' }}
                            placeholder="Briefly describe the issue..."
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            disabled={isLoading}
                        />
                    </div>
                </div>

                <div style={styles.modalFooter}>
                    <button style={styles.closeBtn} onClick={onClose} disabled={isLoading}>CANCEL</button>
                    <button
                        style={{ ...styles.submitBtn, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                        onClick={handleFormSubmit}
                        disabled={isLoading || !form.issueType || !form.description}
                    >
                        {isLoading ? 'CREATING...' : 'CREATE TICKET'}
                    </button>
                </div>
            </div>
        </div>
    );
};
