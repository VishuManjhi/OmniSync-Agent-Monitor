import React from 'react';

interface MetricData {
    day: string;
    raised?: number;
    resolved?: number;
    onlineTimeHours?: number;
}

interface RatioData {
    totalRaised: number;
    totalResolved: number;
}

export const BarChart: React.FC<{ data: MetricData[] }> = ({ data }) => {
    const hasData = data && data.length > 0 && data.some(d => (d.raised || 0) > 0);
    const maxVal = Math.max(...(data || []).map(d => d.raised || 0), 10);
    const barAreaHeight = 120;
    const gap = 15;

    if (!hasData) {
        return (
            <div style={{ height: `${barAreaHeight}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-highlight)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>No activity recorded in the last 7 days</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: `${gap}px`, padding: '10px', minHeight: `${barAreaHeight + 28}px` }}>
            {data.map((d, i) => {
                const height = ((d.raised || 0) / maxVal) * (barAreaHeight - 10);
                return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                        <div style={{ width: '100%', height: `${barAreaHeight}px`, display: 'flex', alignItems: 'flex-end' }}>
                            <div style={{
                                width: '100%',
                                height: `${Math.max(4, height)}px`,
                                background: 'var(--accent-blue)',
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.5s ease',
                                opacity: 0.85
                            }} />
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                            {d.day.split('-').slice(1).join('/')}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export const PieChart: React.FC<{ ratio: RatioData }> = ({ ratio }) => {
    const { totalRaised, totalResolved } = ratio;
    const percent = totalRaised > 0 ? (totalResolved / totalRaised) * 100 : 0;
    const strokeDasharray = `${percent} ${100 - percent}`;

    return (
        <div style={{ position: 'relative', width: '120px', height: '120px' }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--glass-border)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.915" fill="none" stroke={totalRaised > 0 ? "var(--accent-blue)" : "var(--glass-border)"} strokeWidth="3"
                    strokeDasharray={strokeDasharray} strokeDashoffset="0" strokeLinecap="round" />
            </svg>
            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: totalRaised > 0 ? 'var(--accent-blue)' : 'var(--text-muted)' }}>{totalRaised > 0 ? `${Math.round(percent)}%` : '0'}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: '700' }}>{totalRaised > 0 ? 'RESOLVED' : 'NO DATA'}</span>
            </div>
        </div>
    );
};

export const AreaChart: React.FC<{ data: MetricData[] }> = ({ data }) => {
    const hasData = data && data.length > 0;
    const maxVal = Math.max(...(data || []).map(d => d.onlineTimeHours || 0), 20); // Default max 20 based on image
    const width = 600;
    const height = 250;
    const padding = { top: 20, right: 30, bottom: 40, left: 40 };

    if (!hasData) {
        return (
            <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-highlight)', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600' }}>No temporal data available</span>
            </div>
        );
    }

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const xDivisor = Math.max(1, data.length - 1);

    // Generate points for the area and line
    const points = data.map((d, i) => {
        const x = padding.left + (i / xDivisor) * chartWidth;
        const y = padding.top + chartHeight - ((d.onlineTimeHours || 0) / maxVal) * chartHeight;
        return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    // Grid lines (horizontal)
    const gridValues = [0, 5, 10, 15, 20];

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <span style={{ cursor: 'pointer', color: 'var(--accent-blue)', fontWeight: '800' }}>←</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>February 01 - February 28</span>
                <span style={{ cursor: 'pointer', color: 'var(--accent-blue)', fontWeight: '800' }}>→</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '40px' }}>
                <div style={{ width: '12px', height: '12px', background: 'var(--accent-blue)', borderRadius: '2px' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-blue)' }}>Total Hours</span>
            </div>

            <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Grid Lines */}
                    {gridValues.map(v => {
                        const y = padding.top + chartHeight - (v / maxVal) * chartHeight;
                        return (
                            <React.Fragment key={v}>
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={width - padding.right}
                                    y2={y}
                                    stroke="var(--glass-border)"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                />
                                <text x={padding.left - 10} y={y + 4} textAnchor="end" style={{ fontSize: '10px', fill: 'var(--text-muted)', fontWeight: '700' }}>{v}</text>
                            </React.Fragment>
                        );
                    })}

                    {/* Vertical Lines */}
                    {data.map((_, i) => {
                        const x = padding.left + (i / xDivisor) * chartWidth;
                        return (
                            <line
                                key={i}
                                x1={x}
                                y1={padding.top}
                                x2={x}
                                y2={padding.top + chartHeight}
                                stroke="var(--glass-border)"
                                strokeWidth="1"
                                opacity="0.3"
                            />
                        );
                    })}

                    {/* Area Fill */}
                    <path d={areaPath} fill="url(#areaGradient)" />
                    <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0.01" />
                        </linearGradient>
                    </defs>

                    {/* Path Line */}
                    <path d={linePath} fill="none" stroke="var(--accent-blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Date Labels (X-Axis) */}
                    {data.map((d, i) => {
                        if (i % 2 !== 0 && i !== 0 && i !== data.length - 1) return null; // Only show some labels for clarity
                        const x = padding.left + (i / xDivisor) * chartWidth;
                        const day = d.day.split('-')[2];
                        return (
                            <text
                                key={i}
                                x={x}
                                y={padding.top + chartHeight + 20}
                                textAnchor="middle"
                                style={{ fontSize: '10px', fill: 'var(--text-muted)', fontWeight: '700' }}
                            >
                                {day}
                            </text>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};
export const PerformanceAreaChart: React.FC<{ data: MetricData[] }> = ({ data }) => {
    const hasData = data && data.length > 0;
    const maxVal = Math.max(...(data || []).map(d => Math.max(d.raised || 0, d.resolved || 0)), 5);
    const width = 600;
    const height = 250;
    const padding = { top: 20, right: 30, bottom: 40, left: 40 };

    if (!hasData) {
        return (
            <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass-highlight)', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600' }}>No performance data available</span>
            </div>
        );
    }

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const xDivisor = Math.max(1, data.length - 1);

    const getX = (i: number) => padding.left + (i / xDivisor) * chartWidth;
    const getY = (val: number) => padding.top + chartHeight - (val / maxVal) * chartHeight;

    const raisedPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.raised || 0) }));
    const resolvedPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.resolved || 0) }));

    const raisedLine = raisedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const resolvedLine = resolvedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const raisedArea = `${raisedLine} L ${raisedPoints[raisedPoints.length - 1].x} ${padding.top + chartHeight} L ${raisedPoints[0].x} ${padding.top + chartHeight} Z`;
    const resolvedArea = `${resolvedLine} L ${resolvedPoints[resolvedPoints.length - 1].x} ${padding.top + chartHeight} L ${resolvedPoints[0].x} ${padding.top + chartHeight} Z`;

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', background: 'var(--accent-blue)', borderRadius: '2px' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)' }}>Tickets Raised</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)' }}>Tickets Resolved</span>
                </div>
            </div>

            <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                        <linearGradient id="raisedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0.01" />
                        </linearGradient>
                        <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                        </linearGradient>
                    </defs>

                    {/* Grid */}
                    {[0, 0.25, 0.5, 0.75, 1].map(v => {
                        const y = padding.top + v * chartHeight;
                        return (
                            <line key={v} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="4 4" />
                        );
                    })}

                    {/* Areas */}
                    <path d={raisedArea} fill="url(#raisedGrad)" />
                    <path d={resolvedArea} fill="url(#resolvedGrad)" />

                    {/* Lines */}
                    <path d={raisedLine} fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={resolvedLine} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                    {/* X-Axis Labels */}
                    {data.map((d, i) => {
                        if (i % 2 !== 0 && i !== 0 && i !== data.length - 1) return null;
                        const x = getX(i);
                        return (
                            <text key={i} x={x} y={padding.top + chartHeight + 20} textAnchor="middle" style={{ fontSize: '10px', fill: 'var(--text-muted)', fontWeight: '700' }}>
                                {d.day.split('-').slice(1).join('/')}
                            </text>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};
