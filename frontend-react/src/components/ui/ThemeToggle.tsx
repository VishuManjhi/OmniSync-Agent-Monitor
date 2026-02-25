import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
    position?: {
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
    }
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ position }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            style={{ ...styles.toggle, ...position }}
            className="glass-card hover-lift"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            {theme === 'light' ? (
                <Moon size={20} color="var(--accent-blue)" />
            ) : (
                <Sun size={20} color="var(--accent-yellow)" />
            )}
        </button>
    );
};

const styles = {
    toggle: {
        position: 'fixed' as const,
        bottom: '24px',
        right: '24px',
        width: '48px',
        height: '48px',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '12px',
        zIndex: 1000,
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        cursor: 'pointer',
    }
};

export default ThemeToggle;
