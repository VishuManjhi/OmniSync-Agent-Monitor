import React from 'react';
import {
    Shield,
    LayoutDashboard,
    Inbox,
    BarChart3,
    Activity,
    User,
    MessageSquare,
    LogOut
} from 'lucide-react';
import { styles } from './agentDashboardStyles';

interface AgentSideNavProps {
    activeView: string;
    setActiveView: (view: 'DASHBOARD' | 'TICKETS' | 'COMMAND_CENTRE' | 'PROFILE' | 'CHAT' | 'METRICS') => void;
    agent: any;
    logout: () => void;
}

const AgentSideNav: React.FC<AgentSideNavProps> = ({ activeView, setActiveView, agent, logout }) => {
    return (
        <aside style={styles.sideNav}>
            <div style={styles.navHeader}>
                <div style={styles.logoBox}>
                    <Shield size={24} color="var(--accent-blue)" />
                </div>
                <span style={styles.navLogo}>OMNISYNC</span>
            </div>

            <nav style={styles.navLinks}>
                <button
                    onClick={() => setActiveView('DASHBOARD')}
                    style={{ ...styles.navItem, ...(activeView === 'DASHBOARD' ? styles.navItemActive : {}) }}
                    className={activeView === 'DASHBOARD' ? 'nav-item-active' : ''}
                >
                    <LayoutDashboard size={20} /> Dashboard
                </button>
                <button
                    onClick={() => setActiveView('TICKETS')}
                    style={{ ...styles.navItem, ...(activeView === 'TICKETS' ? styles.navItemActive : {}) }}
                    className={activeView === 'TICKETS' ? 'nav-item-active' : ''}
                >
                    <Inbox size={20} /> Tickets
                </button>
                <button
                    onClick={() => setActiveView('COMMAND_CENTRE')}
                    style={{ ...styles.navItem, ...(activeView === 'COMMAND_CENTRE' ? styles.navItemActive : {}) }}
                    className={activeView === 'COMMAND_CENTRE' ? 'nav-item-active' : ''}
                >
                    <Activity size={20} /> Command Centre
                </button>
                <button
                    onClick={() => setActiveView('METRICS')}
                    style={{ ...styles.navItem, ...(activeView === 'METRICS' ? styles.navItemActive : {}) }}
                    className={activeView === 'METRICS' ? 'nav-item-active' : ''}
                >
                    <BarChart3 size={20} /> Metrics
                </button>
                <button
                    onClick={() => setActiveView('PROFILE')}
                    style={{ ...styles.navItem, ...(activeView === 'PROFILE' ? styles.navItemActive : {}) }}
                    className={activeView === 'PROFILE' ? 'nav-item-active' : ''}
                >
                    <User size={20} /> Profile
                </button>
                <button
                    onClick={() => setActiveView('CHAT')}
                    style={{ ...styles.navItem, ...(activeView === 'CHAT' ? styles.navItemActive : {}) }}
                    className={activeView === 'CHAT' ? 'nav-item-active' : ''}
                >
                    <MessageSquare size={20} /> Internal Chat
                </button>
            </nav>

            <div style={styles.navFooter}>
                <div style={styles.miniProfile}>
                    <div style={styles.avatar}>{agent?.name?.[0]}</div>
                    <div style={styles.profileText}>
                        <span style={styles.profileName}>{agent?.name}</span>
                        <span style={styles.profileId}>{agent?.agentId}</span>
                    </div>
                </div>
                <button onClick={logout} style={styles.logoutBtn}>
                    <LogOut size={16} /> Logout System
                </button>
            </div>
        </aside>
    );
};

export default AgentSideNav;
