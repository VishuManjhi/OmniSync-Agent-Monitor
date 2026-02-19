const API_BASE_URL = 'http://localhost:3003';

async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.error) {
        message = body.error;
      }
    } catch {
      // ignore JSON parse issues
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

// Agents
export async function fetchAgents() {
  return apiFetch('/api/agents', { method: 'GET' });
}

export async function fetchAgent(agentId) {
  return apiFetch(`/api/agents/${encodeURIComponent(agentId)}`, { method: 'GET' });
}

export async function forceLogoutAgent(agentId) {
  return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/force-logout`, {
    method: 'POST'
  });
}

// Sessions
export async function fetchAllAgentSessions() {
  return apiFetch('/api/agent-sessions', { method: 'GET' });
}

export async function saveAgentSession(session) {
  return apiFetch('/api/agent-sessions', {
    method: 'POST',
    body: JSON.stringify(session)
  });
}

export async function fetchCurrentSession(agentId) {
  return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/sessions/current`, {
    method: 'GET'
  });
}

// Tickets
export async function createOrUpdateTicket(ticket) {
  return apiFetch('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(ticket)
  });
}

export async function updateTicket(ticketId, updates) {
  return apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

export async function fetchAgentTickets(agentId) {
  return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/tickets`, {
    method: 'GET'
  });
}

export async function fetchAllTickets() {
  return apiFetch('/api/tickets', { method: 'GET' });
}

// Queue stats
export async function fetchQueueStats() {
  return apiFetch('/api/queue-stats', { method: 'GET' });
}

export async function fetchSupervisorActivity(supervisorId) {
  return apiFetch(`/api/supervisors/${encodeURIComponent(supervisorId)}/activity`, {
    method: 'GET'
  });
}

