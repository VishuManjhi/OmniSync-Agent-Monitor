import React from 'react';
import { LogOut } from 'lucide-react';
import { styles } from './agentDashboardStyles';

interface AgentProfileProps {
    agent: any;
    logout: () => void;
}

const AgentProfile: React.FC<AgentProfileProps> = ({ agent, logout }) => {
    return (
        <div className="fade-in">
            <section className="glass-card" style={styles.profileCard}>
                <div style={styles.profileCover} />
                <div style={styles.profileMeta}>
                    <div style={styles.largeAvatar}>{agent?.name?.[0]}</div>
                    <div style={styles.profileMainInfo}>
                        <h2 style={styles.profileDisplayName}>{agent?.name}</h2>
                        <span style={styles.profileTitleBadge}>Certified OmniSync Agent</span>
                    </div>
                </div>

                <div style={styles.profileDetailsGrid}>
                    <div style={styles.detailItem}>
                        <span style={styles.detailLabel}>Agent Identifier</span>
                        <span style={styles.detailValue}>{agent?.agentId}</span>
                    </div>
                    <div style={styles.detailItem}>
                        <span style={styles.detailLabel}>Access Level</span>
                        <span style={styles.detailValue}>Standard Terminal Access</span>
                    </div>
                    <div style={styles.detailItem}>
                        <span style={styles.detailLabel}>Performance Tier</span>
                        <span style={styles.detailValue}>Tier 1 Specialist</span>
                    </div>
                    <div style={styles.detailItem}>
                        <span style={styles.detailLabel}>Account Created</span>
                        <span style={styles.detailValue}>Feb 2026</span>
                    </div>
                </div>

                <div style={styles.profileActions}>
                    <button onClick={logout} style={styles.dangerBtn}>
                        <LogOut size={18} /> Sign Out of System
                    </button>
                </div>
            </section>
        </div>
    );
};

export default AgentProfile;
