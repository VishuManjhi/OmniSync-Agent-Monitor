import { apiFetch } from './base';
import type { Agent, AgentSession, Ticket, QueueStats, PaginatedTickets, Message, AgentAnalytics, AgentReport, AsyncJobsResponse, SlaBreachResponse } from './types';

const API_BASE_URL = 'http://localhost:3003';
const TOKEN_KEY = 'omnisync_jwt';

interface AsyncJobAccepted {
    ok: boolean;
    jobId: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

interface AsyncJobStatus {
    jobId: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    result?: {
        downloadUrl?: string;
        sentTo?: string;
    };
    error?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const pollAsyncJob = async (jobId: string, maxAttempts = 45, waitMs = 1000) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const status = await apiFetch<AsyncJobStatus>(`/api/queue-stats/jobs/${jobId}`);
        if (status.status === 'COMPLETED') return status;
        if (status.status === 'FAILED') {
            throw new Error(status.error || 'ASYNC_JOB_FAILED');
        }
        await sleep(waitMs);
    }

    throw new Error('ASYNC_JOB_TIMEOUT');
};

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
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const accepted = await fetch(`${API_BASE_URL}/api/queue-stats/agent/${agentId}/report/export`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ period })
    });

    if (!accepted.ok) {
        let message = `HTTP ${accepted.status}`;
        try {
            const body = await accepted.json();
            if (body?.error) message = body.error;
        } catch {
            // noop
        }
        throw new Error(message);
    }

    const acceptedBody = await accepted.json() as AsyncJobAccepted;
    const done = await pollAsyncJob(acceptedBody.jobId);

    if (!done.result?.downloadUrl) {
        throw new Error('REPORT_DOWNLOAD_URL_MISSING');
    }

    const fileRes = await fetch(`${API_BASE_URL}${done.result.downloadUrl}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!fileRes.ok) {
        throw new Error(`HTTP ${fileRes.status}`);
    }

    return fileRes.blob();
};

export const emailAgentReport = async (agentId: string, period: 'weekly' | 'monthly') => {
    const accepted = await apiFetch<AsyncJobAccepted>(`/api/queue-stats/agent/${agentId}/report/email`, {
        method: 'POST',
        body: JSON.stringify({ period })
    });

    const done = await pollAsyncJob(accepted.jobId);
    return { ok: true, sentTo: done.result?.sentTo || 'configured recipient' };
};

export const fetchAsyncJobs = (page = 1, limit = 25) =>
    apiFetch<AsyncJobsResponse>(`/api/queue-stats/jobs?page=${page}&limit=${limit}`);

export const fetchSlaBreaches = (hours = 24, page = 1, limit = 10) =>
    apiFetch<SlaBreachResponse>(`/api/queue-stats/sla/breaches?hours=${hours}&page=${page}&limit=${limit}`);

export const runSlaAutomation = (hours = 24) =>
    apiFetch<{ ok: boolean; escalated: number; notified: boolean; ticketIds: string[] }>(`/api/queue-stats/sla/automate`, {
        method: 'POST',
        body: JSON.stringify({ hours })
    });
