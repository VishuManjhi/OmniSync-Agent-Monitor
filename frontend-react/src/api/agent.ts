import { apiFetch } from './base';
import type { Agent, AgentSession, Ticket, QueueStats, PaginatedTickets, Message, AgentAnalytics, AgentReport } from './types';

const API_BASE_URL = 'http://localhost:3003';
const TOKEN_KEY = 'omnisync_jwt';

export const fetchAgents = () => apiFetch<Agent[]>('/api/agents');
export const fetchSessions = () => apiFetch<AgentSession[]>('/api/agent-sessions');
export const fetchTickets = (page = 1, limit = 10, search = '', status = 'ALL') =>
    apiFetch<PaginatedTickets>(`/api/tickets?page=${page}&limit=${limit}&search=${search}&status=${status}`);
export const fetchQueueStats = () => apiFetch<QueueStats>('/api/queue-stats');
export const fetchSupervisorActivity = (supervisorId: string) =>
    apiFetch<Ticket[]>(`/api/supervisors/${supervisorId}/activity`);
export const fetchBroadcasts = () => apiFetch<Message[]>('/api/broadcasts');

export const forceLogout = (agentId: string) =>
    apiFetch(`/api/agents/${agentId}/force-logout`, { method: 'POST' });

export const updateTicket = (ticketId: string, updates: Partial<Ticket>) =>
    apiFetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
    });

export const createTicket = (ticket: Partial<Ticket>) =>
    apiFetch<Ticket>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(ticket)
    });

export const saveAgentSession = (session: Partial<AgentSession>) =>
    apiFetch('/api/agent-sessions', {
        method: 'POST',
        body: JSON.stringify(session)
    });

export const fetchCurrentSession = (agentId: string) =>
    apiFetch<AgentSession>(`/api/agents/${agentId}/sessions/current`);

export const fetchAgentTickets = (agentId: string, page = 1, limit = 10, search = '', status = 'ALL') =>
    apiFetch<PaginatedTickets>(`/api/agents/${agentId}/tickets?page=${page}&limit=${limit}&search=${search}&status=${status}`);

export const fetchAgent = (agentId: string) =>
    apiFetch<Agent>(`/api/agents/${agentId}`);

export const updateAgentEmail = (agentId: string, email: string) =>
    apiFetch<{ ok: boolean; agentId: string; email: string }>(`/api/agents/${agentId}/email`, {
        method: 'PATCH',
        body: JSON.stringify({ email })
    });

export const fetchAgentAnalytics = (agentId: string) =>
    apiFetch<AgentAnalytics>(`/api/queue-stats/agent/${agentId}`);

export const fetchAgentReport = (agentId: string, period: 'weekly' | 'monthly') =>
    apiFetch<AgentReport>(`/api/queue-stats/agent/${agentId}/report?period=${period}`);

export const exportAgentReport = async (agentId: string, period: 'weekly' | 'monthly') => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const primary = await fetch(`${API_BASE_URL}/api/queue-stats/agent/${agentId}/report/export?period=${period}`, { headers });
    if (primary.ok) return primary.blob();

    const fallback = primary.status === 404
        ? await fetch(`${API_BASE_URL}/api/queue-stats/agent/${agentId}/export-report?period=${period}`, { headers })
        : null;

    if (fallback?.ok) return fallback.blob();

    const failedRes = fallback || primary;
    let message = `HTTP ${failedRes.status}`;
    try {
        const body = await failedRes.json();
        if (body?.error) message = body.error;
    } catch {
        // noop
    }
    throw new Error(message);
};

export const emailAgentReport = (agentId: string, period: 'weekly' | 'monthly') =>
    apiFetch<{ ok: boolean; sentTo: string }>(`/api/queue-stats/agent/${agentId}/report/email`, {
        method: 'POST',
        body: JSON.stringify({ period })
    });
