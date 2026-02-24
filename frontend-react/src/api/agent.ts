import { apiFetch } from './base';
import type { Agent, AgentSession, Ticket, QueueStats, PaginatedTickets } from './types';

export const fetchAgents = () => apiFetch<Agent[]>('/api/agents');
export const fetchSessions = () => apiFetch<AgentSession[]>('/api/agent-sessions');
export const fetchTickets = (page = 1, limit = 10) =>
    apiFetch<PaginatedTickets>(`/api/tickets?page=${page}&limit=${limit}`);
export const fetchQueueStats = () => apiFetch<QueueStats>('/api/queue-stats');
export const fetchSupervisorActivity = (supervisorId: string) =>
    apiFetch<Ticket[]>(`/api/supervisors/${supervisorId}/activity`);

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

export const fetchAgentTickets = (agentId: string, page = 1, limit = 10, search = '') =>
    apiFetch<PaginatedTickets>(`/api/agents/${agentId}/tickets?page=${page}&limit=${limit}&search=${search}`);

export const fetchAgent = (agentId: string) =>
    apiFetch<Agent>(`/api/agents/${agentId}`);
