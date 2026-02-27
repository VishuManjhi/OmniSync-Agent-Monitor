import React from 'react';
import {
    Shield,
    LayoutDashboard,
    Users,
    FileText,
    ListTodo,
    Bot,
    ClipboardList,
    Activity,
    MessageSquare,
    LogOut
} from 'lucide-react';
import { styles } from '../agent/agentDashboardStyles';

interface SupervisorSideNavProps {
    activeView: 'MONITOR' | 'AGENTS' | 'REPORTS' | 'JOBS' | 'AUTOMATION' | 'ACTIVITY' | 'WORKSTATION' | 'MESSAGING';
    setActiveView: (view: 'MONITOR' | 'AGENTS' | 'REPORTS' | 'JOBS' | 'AUTOMATION' | 'ACTIVITY' | 'WORKSTATION' | 'MESSAGING') => void;
    supervisorId?: string;
    logout: () => void;
}

const SupervisorSideNav: React.FC<SupervisorSideNavProps> = ({ activeView, setActiveView, supervisorId, logout }) => {
    return (
        <aside style={styles.sideNav}>
            <div style={styles.navHeader}>
                <div style={styles.logoBox}>
                    <Shield size={24} color="var(--accent-yellow)" />
                </div>
                <span style={styles.navLogo}>RESTROBOARD</span>
            </div>

            <nav style={styles.navLinks}>
                <button
                    onClick={() => setActiveView('MONITOR')}
                    style={{ ...styles.navItem, ...(activeView === 'MONITOR' ? styles.navItemActive : {}) }}
                    className={activeView === 'MONITOR' ? 'nav-item-active' : ''}
                >
                    <LayoutDashboard size={20} /> Dashboard
                </button>
                <button
                    onClick={() => setActiveView('AGENTS')}
                    style={{ ...styles.navItem, ...(activeView === 'AGENTS' ? styles.navItemActive : {}) }}
                    className={activeView === 'AGENTS' ? 'nav-item-active' : ''}
                >
                    <Users size={20} /> Agents
                </button>
                <button
                    onClick={() => setActiveView('REPORTS')}
                    style={{ ...styles.navItem, ...(activeView === 'REPORTS' ? styles.navItemActive : {}) }}
                    className={activeView === 'REPORTS' ? 'nav-item-active' : ''}
                >
                    <FileText size={20} /> Report Centre
                </button>
                <button
                    onClick={() => setActiveView('JOBS')}
                    style={{ ...styles.navItem, ...(activeView === 'JOBS' ? styles.navItemActive : {}) }}
                    className={activeView === 'JOBS' ? 'nav-item-active' : ''}
                >
                    <ListTodo size={20} /> Job Status
                </button>
                <button
                    onClick={() => setActiveView('AUTOMATION')}
                    style={{ ...styles.navItem, ...(activeView === 'AUTOMATION' ? styles.navItemActive : {}) }}
                    className={activeView === 'AUTOMATION' ? 'nav-item-active' : ''}
                >
                    <Bot size={20} /> SLA Automation
                </button>
                <button
                    onClick={() => setActiveView('ACTIVITY')}
                    style={{ ...styles.navItem, ...(activeView === 'ACTIVITY' ? styles.navItemActive : {}) }}
                    className={activeView === 'ACTIVITY' ? 'nav-item-active' : ''}
                >
                    <ClipboardList size={20} /> Activity Log
                </button>
                <button
                    onClick={() => setActiveView('WORKSTATION')}
                    style={{ ...styles.navItem, ...(activeView === 'WORKSTATION' ? styles.navItemActive : {}) }}
                    className={activeView === 'WORKSTATION' ? 'nav-item-active' : ''}
                >
                    <Activity size={20} /> Workstation
                </button>
                <button
                    onClick={() => setActiveView('MESSAGING')}
                    style={{ ...styles.navItem, ...(activeView === 'MESSAGING' ? styles.navItemActive : {}) }}
                    className={activeView === 'MESSAGING' ? 'nav-item-active' : ''}
                >
                    <MessageSquare size={20} /> Messaging
                </button>
            </nav>

            <div style={styles.navFooter}>
                <div style={styles.miniProfile}>
                    <div style={styles.avatar}>S</div>
                    <div style={styles.profileText}>
                        <span style={styles.profileName}>Supervisor</span>
                        <span style={styles.profileId}>{supervisorId || 'N/A'}</span>
                    </div>
                </div>
                <button onClick={logout} style={styles.logoutBtn}>
                    <LogOut size={16} /> Logout System
                </button>
            </div>
        </aside>
    );
};

export default SupervisorSideNav;
