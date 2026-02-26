import React from 'react';

interface StatusPieProps {
    onCall: number;
    onBreak: number;
    offline: number;
}

interface TicketsBarProps {
    raised: number;
    resolved: number;
}

export const SupervisorStatusPie: React.FC<StatusPieProps> = ({ onCall, onBreak, offline }) => {
    const total = onCall + onBreak + offline;
    const onCallPct = total > 0 ? (onCall / total) * 100 : 0;
    const onBreakPct = total > 0 ? (onBreak / total) * 100 : 0;

    const background = `conic-gradient(
        #60a5fa 0% ${onCallPct}%,
        #fb923c ${onCallPct}% ${onCallPct + onBreakPct}%,
        #94a3b8 ${onCallPct + onBreakPct}% 100%
    )`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '180px', height: '180px', borderRadius: '50%', background }}>
                    <div style={{
                        position: 'absolute',
                        inset: '20px',
                        background: 'var(--bg-card)',
                        borderRadius: '50%',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column'
                    }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{total}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>TRACKED</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                    { label: 'On Call', value: onCall, color: '#60a5fa' },
                    { label: 'On Break', value: onBreak, color: '#fb923c' },
                    { label: 'Offline', value: offline, color: '#94a3b8' }
                ].map(item => (
                    <div key={item.label} style={{
                        border: '1px solid var(--glass-border)',
                        borderRadius: '10px',
                        padding: '10px',
                        background: 'var(--glass-highlight)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>{item.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const SupervisorTicketsBar: React.FC<TicketsBarProps> = ({ raised, resolved }) => {
    const max = Math.max(raised, resolved, 1);
    const raisedHeight = (raised / max) * 170;
    const resolvedHeight = (resolved / max) * 170;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ height: '210px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '36px' }}>
                {[
                    { label: 'Raised', value: raised, color: 'var(--accent-blue)', height: raisedHeight },
                    { label: 'Resolved', value: resolved, color: '#10b981', height: resolvedHeight }
                ].map(item => (
                    <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)' }}>{item.value}</span>
                        <div style={{
                            width: '64px',
                            height: `${Math.max(8, item.height)}px`,
                            borderRadius: '10px 10px 0 0',
                            background: item.color,
                            opacity: 0.85,
                            boxShadow: `0 0 10px ${item.color}55`
                        }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
