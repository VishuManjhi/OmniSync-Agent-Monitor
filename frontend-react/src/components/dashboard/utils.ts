import type { AgentSession } from '../../api/types';

export const deriveAgentStatus = (session?: AgentSession) => {
    if (!session || session.clockOutTime) return 'OFFLINE';
    const lastBreak = session.breaks && session.breaks.length > 0 ? session.breaks[session.breaks.length - 1] : null;
    if (lastBreak && !lastBreak.breakOut) return 'ON_BREAK';
    if (session.onCall) return 'ON_CALL';
    return 'ACTIVE';
};

export const CARD_GRADIENTS = [
    { border: 'rgba(250,204,21,0.45)', glow: 'rgba(250,204,21,0.08)', accent: '#facc15' }, // yellow
    { border: 'rgba(96,165,250,0.45)', glow: 'rgba(96,165,250,0.08)', accent: '#60a5fa' }, // blue
    { border: 'rgba(167,139,250,0.45)', glow: 'rgba(167,139,250,0.08)', accent: '#a78bfa' }, // violet
    { border: 'rgba(52,211,153,0.45)', glow: 'rgba(52,211,153,0.08)', accent: '#34d399' }, // emerald
    { border: 'rgba(251,146,60,0.45)', glow: 'rgba(251,146,60,0.08)', accent: '#fb923c' }, // orange
    { border: 'rgba(244,114,182,0.45)', glow: 'rgba(244,114,182,0.08)', accent: '#f472b6' }, // pink
    { border: 'rgba(34,211,238,0.45)', glow: 'rgba(34,211,238,0.08)', accent: '#22d3ee' }, // cyan
    { border: 'rgba(163,230,53,0.45)', glow: 'rgba(163,230,53,0.08)', accent: '#a3e635' }, // lime
];
