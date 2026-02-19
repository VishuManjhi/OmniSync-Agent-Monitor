import { getAllFilters, saveFilter, clearAllFilters, STORAGE_KEYS } from './utils/sessionStorage.js';
import * as state from './state.js';
import { agentCardTimers, highlightedAgentCards } from './utils/uiWeakState.js';
import './utils/memoryDebug.js';
import {
  fetchAllTickets,
  fetchQueueStats,
  fetchAllAgentSessions,
  fetchAgents,
  updateTicket as apiUpdateTicket,
  createOrUpdateTicket as apiCreateTicket,
  forceLogoutAgent,
  fetchSupervisorActivity
} from './api.js';
import { initWebSocket, sendMessage } from './comms/websocket.js';



function normalizeTicket(t) {
  return {
    ...t,
    attachments: Array.isArray(t.attachments) ? t.attachments : [],
    status: t.status || 'OPEN',
    resolvedAt: t.resolvedAt || null,
    issueDateTime: t.issueDateTime
      ? new Date(t.issueDateTime).toISOString()
      : null
  };
}

function normalizeSession(s) {
  const clockInTime =
    s.clockInTime ??
    (s.clockIn ? new Date(s.clockIn).toISOString() : null);

  const clockOutTime =
    s.clockOutTime ??
    (s.clockOutTime ? new Date(s.clockOutTime).toISOString() : null);

  return {
    ...s,
    clockInTime,
    clockOutTime,
    breaks: Array.isArray(s.breaks) ? s.breaks : [],
    onCall: s.onCall === true
  };
}
function deriveAgentState(session) {
  if (!session) return 'OFFLINE';
  if (session.clockOutTime) return 'OFFLINE';

  const lastBreak = session.breaks.at(-1);
  if (lastBreak && !lastBreak.breakOut) return 'ON_BREAK';

  if (session.onCall) return 'ON_CALL';

  return 'ACTIVE';
}
function updateAgentStateMap(session) {
  if (!session || !session.agentId) return;

  const status = deriveAgentState(session);
  const now = Date.now();
  const aid = session.agentId.toLowerCase();

  const prev = agentStateMap.get(aid);

  if (!prev || prev.status !== status) {
    agentStateMap.set(aid, {
      status,
      since: now
    });
  }
}
const queueMetrics = {
  queueDepth: 0,
  waitingCalls: 0,
  activeAgents: 0,
  slaPercent: 0
};



window.__debug = { agentCardTimers, highlightedAgentCards }; //debug.agentCardTimers

const ahtWorker = new Worker(
  new URL('./workers/ahtWorker.js', import.meta.url),
  { type: 'module' }
);

// debug
window.__ahtWorker = ahtWorker;
const agentStateMap = new Map();
window.__agentStateMap = agentStateMap;
const incidentSet = new Set();
window.__incidentSet = incidentSet;

let selectedAgentId = null;
let allAgents = [];
let activeHighlightedCard = null;
let isWSRefresh = false;
let selectedTicketId = null;
let isAHTVisible = false;
let agentNameMap = {};
let cachedGlobalAHT = null;
let cachedPerAgentAHT = null;
let hasAHTData = false;


export async function initialize() {
  const storedAgentId = sessionStorage.getItem('monitoredAgentId');
  if (storedAgentId) {
    selectedAgentId = storedAgentId.toLowerCase();
  }

  // Note: openDB removal
  // db = await openDB(); 
  document.getElementById('assign-agent-select')
    ?.addEventListener('change', (e) => {
      selectedAgentId = (e.target.value ? e.target.value.toLowerCase() : null);

      document
        .querySelectorAll('.agent-card.highlight')
        .forEach(c => c.classList.remove('highlight'));

      if (!selectedAgentId) return;

      const card = document.querySelector(
        `.agent-card[data-agent-id="${selectedAgentId}"]`
      );

      if (card) {
        card.classList.add('highlight');
        activeHighlightedCard = card;
      }
    });


  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  loadSavedFilters();
  setupFilterHandlers();
  setupModalHandlers();
  setupAHTHandlers();
  AgentGridDelegation();

  await loadAgentNames();

  // 📡 REST-polling is now a safety net. Real-time uses WS.
  initWebSocket((data) => {
    if (data.type === 'AGENT_STATUS_CHANGE' || data.type === 'AGENT_STATUS') {
      refreshSupervisorPanel();
    }
  });

  refreshSupervisorPanel();
  setInterval(async () => {
    try {
      const stats = await fetchQueueStats();
      renderQueueStats(stats);
    } catch (err) {
      console.warn('[Supervisor] Failed to fetch queue stats:', err.message);
    }
    refreshSupervisorPanel();
  }, 5000);
}
ahtWorker.onmessage = (e) => {
  const { globalAHT, perAgentAHT } = e.data;

  cachedGlobalAHT = globalAHT;
  cachedPerAgentAHT = perAgentAHT;
  hasAHTData = true;

  console.log('[AHT cached]', { globalAHT, perAgentAHT });
};

async function loadAgents() {
  try {
    const [rawAgents, rawSessions] = await Promise.all([
      fetchAgents(),
      fetchAllAgentSessions()
    ]);

    const sessions = rawSessions.map(normalizeSession);
    const agents = (rawAgents || []).map(a => ({
      agentId: a.agentId.toLowerCase(),
      name: a.name
    }));

    // Cache names
    agents.forEach(a => {
      agentNameMap[a.agentId] = a.name;
    });

    processSessionsWithAgents(agents, sessions);
  } catch (err) {
    console.warn('[Supervisor] Failed to load agents/sessions:', err.message);
  }
}
function formatSecondsToMinSec(seconds) {
  if (seconds == null || isNaN(seconds)) return '—';

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function processSessionsWithAgents(agentList, sessionList) {
  const map = new Map();

  // 1. Initialize all agents as OFFLINE
  agentList.forEach(a => {
    map.set(a.agentId, {
      agentId: a.agentId,
      state: 'OFFLINE',
      clockInTime: null,
      clockOutTime: null,
      session: null
    });
  });

  // 2. Overlay with latest session data
  sessionList.forEach(s => {
    const aid = s.agentId.toLowerCase();
    const prev = map.get(aid);

    // Only update if this session is newer than what we might have (redundant but safe)
    if (prev) {
      const prevIn = new Date(prev.clockInTime || 0).getTime();
      const currIn = new Date(s.clockInTime || 0).getTime();

      if (currIn > prevIn) {
        map.set(aid, {
          agentId: aid,
          state: deriveAgentState(s),
          clockInTime: s.clockInTime,
          clockOutTime: s.clockOutTime,
          session: s
        });
      }
    } else {
      // Agent not in formal list? Still add them.
      map.set(aid, {
        agentId: aid,
        state: deriveAgentState(s),
        clockInTime: s.clockInTime,
        clockOutTime: s.clockOutTime,
        session: s
      });
    }
  });

  allAgents = Array.from(map.values());

  allAgents.forEach(agent => {
    if (agent.session) {
      updateAgentStateMap(agent.session);
    } else {
      // Explicitly mark as offline in state map if no session
      agentStateMap.set(agent.agentId, { status: 'OFFLINE', since: Date.now() });
    }
  });

  renderAgents();
  populateAssignableAgents();
  if (selectedAgentId) renderAgentDetails(selectedAgentId);
}
function AgentGridDelegation() {
  const grid = document.getElementById('agent-grid');
  if (!grid) return;

  grid.addEventListener('click', (e) => {

    const logoutBtn = e.target.closest('.force-logout-btn');
    if (logoutBtn) {
      e.stopPropagation();

      const agentId = logoutBtn.dataset.agentId;
      handleForceLogout(agentId);
      return;
    }
    const card = e.target.closest('.agent-card');
    if (!card || !grid.contains(card)) return;

    handleAgentCardClick(card);
  });
}

function handleAgentCardClick(cardEl) {
  const agentId = cardEl.dataset.agentId;
  selectedAgentId = agentId;
  const assignSelect = document.getElementById('assign-agent-select');
  if (assignSelect) {
    assignSelect.value = selectedAgentId;
  }

  sessionStorage.setItem('monitoredAgentId', agentId);
  console.log('Clicked agent:', agentId);

  if (activeHighlightedCard && activeHighlightedCard !== cardEl) {
    activeHighlightedCard.classList.remove('highlight');
  }

  cardEl.classList.add('highlight');
  highlightedAgentCards.add(cardEl);
  activeHighlightedCard = cardEl;

  renderAgentDetails(agentId);

  const ticketContainer = document.getElementById('agent-tickets');
  ticketContainer.innerHTML = '<em>Loading ticket</em>';


  loadTicketsForAgent(agentId);


}


function persistAgentStatus(agentId, status, sessionPatch = {}) {
  // Local status persistence removed in favor of API calls from the agent app.
}

async function loadTickets() {
  try {
    const tickets = (await fetchAllTickets()).map(normalizeTicket);

    tickets.sort(
      (a, b) => new Date(b.issueDateTime) - new Date(a.issueDateTime)
    );

    console.log(
      '[Supervisor] newest tickets:',
      tickets.slice(0, 5).map(t => ({
        id: t.ticketId,
        agent: t.agentId,
        time: t.issueDateTime
      }))
    );
    renderTickets(tickets);
    if (ahtWorker) {
      ahtWorker.postMessage(tickets);
    }
  } catch (err) {
    console.warn('[Supervisor] Failed to load tickets from API:', err.message);
  }
}
// Demo SLA threshold: 30 minutes
const SLA_THRESHOLD_MS = 30 * 60 * 1000;

// Metrics calculations moved to backend API (/api/queue-stats).

function createAgentCard(agent) {
  const card = document.createElement('div');
  card.className = 'agent-card';
  card.dataset.agentId = agent.agentId;
  card.dataset.status = agent.state ? agent.state.toLowerCase().replace('_', '-') : 'offline';

  const statusText = formatStatus(agent.state);
  const name = agentNameMap[agent.agentId] ?? agent.agentId;

  card.innerHTML = `
        <div class="agent-card-header">
            <span class="agent-id">${name}</span>
            <div class="agent-status-dot"></div>
        </div>

        <div class="agent-info-row">
            <span>Current Status</span>
            <span class="agent-info-value" style="color:var(--accent-cyan)">${statusText}</span>
        </div>
        
        <div class="agent-info-row">
            <span>Clocked In</span>
            <span class="agent-info-value">${formatDateTime(agent.clockInTime)}</span>
        </div>

        ${agent.clockOutTime ? `
          <div class="agent-info-row">
              <span>Clocked Out</span>
              <span class="agent-info-value">${formatDateTime(agent.clockOutTime)}</span>
          </div>
        ` : ''}

        <button 
            class="force-logout-btn"
            data-agent-id="${agent.agentId}">
            Terminate Session
        </button>
    `;

  return card;
}

async function renderTicketModal(ticket) {
  const content = document.getElementById('ticket-modal-content');
  const attachmentsContainer = document.getElementById('ticket-modal-attachments');

  content.innerHTML = `
        <p><strong>Agent:</strong> ${ticket.agentId}</p>
        <p><strong>Issue:</strong> ${formatIssueType(ticket.issueType)}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <p><strong>Created:</strong> ${formatDateTime(ticket.issueDateTime)}</p>
        <p><strong>Description:</strong></p>
        <p>${ticket.description || '—'}</p>
    `;
  const attachments = await getAttachmentsForTicket(ticket.ticketId);

  if (!attachments.length) {
    attachmentsContainer.innerHTML = '<em>No attachments</em>';
  } else {
    attachmentsContainer.innerHTML = attachments.map(att => {
      const url = URL.createObjectURL(att.blob);

      return `
                <div style="margin-bottom:6px">
                    📎 ${att.fileName} (${Math.round(att.size / 1024)}kb)
                    <a
                        href="${url}"
                        download="${att.fileName}"
                        style="margin-left:8px; color:#38bdf8"
                        onclick="setTimeout(() => URL.revokeObjectURL('${url}'), 1000)"
                    >
                        Download
                    </a>
                </div>
            `;
    }).join('');
  }

  openTicketModal();
}

function renderTickets(tickets) {
  const panel = document.getElementById('ticket-list');
  if (!panel) return;

  const latest = tickets.slice(0, 7);

  // ---------- RENDER ----------
  panel.innerHTML = latest.map(t => {
    const shortId = t.ticketId ? t.ticketId.substring(0, 4).toUpperCase() : '????';
    return `
    <div
      class="ticket-card"
      data-ticket-id="${t.ticketId}"
      data-status="${t.status}"
    >
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <span style="font-family:'Space Grotesk'; font-weight:800; color:var(--accent-cyan); font-size:15px;">#${shortId}</span>
        <span class="ticket-status">${t.status}</span>
      </div>
      
      <div style="font-size:13px; margin-bottom:6px; display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted);">Agent</span> 
        <span style="color:var(--text-primary); font-weight:700;">${t.agentId ?? '—'}</span>
      </div>
      
      <div style="font-size:13px; margin-bottom:12px; display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted);">Issue</span> 
        <span style="color:var(--text-primary); font-weight:700;">${formatIssueType(t.issueType)}</span>
      </div>

      <p style="font-size:13px; color:var(--text-secondary); line-height:1.5; margin: 12px 0; padding:10px; background:rgba(0,0,0,0.2); border-radius:10px;">
        ${t.description || 'No description provided.'}
      </p>

      <div style="font-size:11px; color:var(--text-dim); border-top: 1px solid rgba(255,255,255,0.05); padding-top:10px; margin-top:10px; display:flex; justify-content:space-between;">
        <span>Raised at</span>
        <span>${formatDateTime(t.issueDateTime)}</span>
      </div>

      ${t.status === 'RESOLUTION_REQUESTED'
        ? `
            <div class="supervisor-actions" style="margin-top:16px; display:flex; gap:10px;">
              <button class="approve-btn" style="flex:1;">Approve</button>
              <button class="reject-btn" style="flex:1;">Reject</button>
            </div>
          `
        : ''
      }
    </div>
  `;
  }).join('');

  // ---------- EVENTS (DELEGATION) ----------
  panel.onclick = async (e) => {
    const approveBtn = e.target.closest('.approve-btn');
    const rejectBtn = e.target.closest('.reject-btn');
    const card = e.target.closest('.ticket-card');

    if (!card) return;

    const ticketId = card.dataset.ticketId;
    const ticket = tickets.find(t => t.ticketId === ticketId);
    if (!ticket) return;

    /* ===== APPROVE ===== */
    if (approveBtn) {
      e.preventDefault();
      e.stopPropagation();

      console.warn('[SUPERVISOR] Approving ticket', ticketId);

      try {
        await apiUpdateTicket(ticketId, {
          status: 'RESOLVED',
          resolvedAt: Date.now()
        });
        loadTickets(); // Refresh
      } catch (err) {
        console.error('Failed to approve ticket:', err);
      }

      return;
    }

    /* ===== REJECT ===== */
    if (rejectBtn) {
      e.preventDefault();
      e.stopPropagation();

      const reason = prompt('Reason for rejection:');
      if (!reason) return;

      console.warn('[SUPERVISOR] Rejecting ticket', ticketId);

      try {
        await apiUpdateTicket(ticketId, {
          status: 'IN_PROGRESS',
          rejectionReason: reason,
          rejectedAt: Date.now()
        });
        loadTickets(); // Refresh
      } catch (err) {
        console.error('Failed to reject ticket:', err);
      }

      return;
    }

    /* ===== NORMAL CLICK ===== */
    selectedTicketId = ticketId;
    await renderTicketModal(ticket);
  };
}

async function populateAssignableAgents() {
  const select = document.getElementById('assign-agent-select');
  if (!select) return;

  try {
    const agents = await fetchAgents();
    // Keep "Unassigned" option
    select.innerHTML = '<option value="">Unassigned</option>';

    agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.agentId;
      option.textContent = `${agent.name} (${agent.agentId})`;

      if (agent.agentId === selectedAgentId) {
        option.selected = true;
      }

      select.appendChild(option);
    });
  } catch (err) {
    console.warn('[Supervisor] Failed to populate assignable agents:', err);
  }
}
function renderAgents() {
  const filter = getAllFilters().status;
  const searchTerm = document.getElementById('agent-search')?.value.toLowerCase() || '';

  let agents = allAgents;

  // Status Filter
  if (filter) {
    const normalizedFilter = filter.toUpperCase().replace('-', '_');
    agents = agents.filter(
      a => a.state === normalizedFilter
    );
  } else {
    // If no filter (All Statuses), only show non-offline agents
    agents = agents.filter(a => a.state !== 'OFFLINE');
  }

  // Search Filter (ID or Name)
  if (searchTerm) {
    agents = agents.filter(a => {
      const name = (agentNameMap[a.agentId] ?? '').toLowerCase();
      const id = (a.agentId ?? '').toLowerCase();
      return name.includes(searchTerm) || id.includes(searchTerm);
    });
  }

  const grid = document.getElementById('agent-grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!agents.length) {
    grid.innerHTML = '<p>No agents found.</p>';
    return;
  }

  agents.forEach(agent => {
    const card = createAgentCard(agent);
    grid.appendChild(card);
  });

  // If selected agent disappeared due to filter
  if (
    selectedAgentId &&
    !agents.some(a => a.agentId === selectedAgentId)
  ) {
    selectedAgentId = null;
    document.getElementById('agent-info').innerHTML =
      '<em>Select an agent</em>';
    document.getElementById('agent-tickets').innerHTML = '';
  }
}


function renderAgentDetails(agentId) {
  const agent = allAgents.find(a => a.agentId === agentId);
  if (!agent) return;

  const container = document.getElementById('agent-info');
  const breaks = agent.session?.breaks || [];

  container.innerHTML = `
    <div class="details-card-content">
      <div class="detail-row">
        <span class="detail-label">Agent ID</span>
        <span class="detail-value">${agent.agentId}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Full Name</span>
        <span class="detail-value">${agentNameMap[agent.agentId] ?? agent.agentId}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Current Status</span>
        <span class="status-badge-inline" data-status="${agent.state.toLowerCase().replace('_', '-')}">${formatStatus(agent.state)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Shift Start</span>
        <span class="detail-value">${agent.clockInTime ? formatDateTime(agent.clockInTime) : '—'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Shift End</span>
        <span class="detail-value">${agent.clockOutTime ? formatDateTime(agent.clockOutTime) : '—'}</span>
      </div>
      
      <div class="detail-section">
        <h4 class="section-title">Break History</h4>
        <div class="break-timeline">
          ${breaks.length === 0
      ? '<div class="empty-timeline">No break data available</div>'
      : breaks.map(b => {
        const start = new Date(b.breakIn).getTime();
        const end = b.breakOut ? new Date(b.breakOut).getTime() : Date.now();
        const duration = formatDuration(end - start);

        return `
                <div class="timeline-item">
                  <div class="timeline-marker"></div>
                  <div class="timeline-content">
                    <div class="timeline-time">${formatDateTime(b.breakIn)} — ${b.breakOut ? formatDateTime(b.breakOut) : '<span class="pulse-text">Ongoing</span>'}</div>
                    <div class="timeline-duration">${duration} total</div>
                  </div>
                </div>
              `;
      }).join('')
    }
        </div>
      </div>
    </div>
  `;
}



async function loadTicketsForAgent(agentId) {
  try {
    const rawTickets = await fetchAgentTickets(agentId);
    const tickets = rawTickets.map(normalizeTicket);

    tickets.sort(
      (a, b) => new Date(b.issueDateTime) - new Date(a.issueDateTime)
    );

    renderTicketsInAgentDetails(tickets);
  } catch (err) {
    console.warn('[Supervisor] Failed to load tickets for agent from API:', err.message);
  }
}

function renderAHT(globalAHT, perAgentAHT) {
  const el = document.getElementById('aht-value');
  if (el) el.textContent = `${globalAHT}s`;

  console.log('[AHT]', {
    globalAHT,
    perAgentAHT
  });
}
function renderAttachments(attachments) {
  const container = document.getElementById('ticket-attachments');
  if (!container) return;

  container.innerHTML = '';

  if (!attachments.length) {
    container.innerHTML = '<p>No attachments.</p>';
    return;
  }

  attachments.forEach(att => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.marginBottom = '8px';
    row.style.padding = '6px 0';

    const name = document.createElement('span');
    name.textContent = att.fileName;
    name.style.fontSize = '14px';

    const download = document.createElement('a');
    download.href = URL.createObjectURL(att.blob);
    download.download = att.fileName;
    download.textContent = '⬇ Download';
    download.style.color = '#6aa9ff';
    download.style.cursor = 'pointer';

    row.appendChild(name);
    row.appendChild(download);

    container.appendChild(row);
  });
}

function renderTicketsInCard(tickets, cardEl) {
  const container = cardEl.querySelector('.agent-tickets');
  if (!container) return;

  const latestFive = tickets
    .sort((a, b) => Number(b.issueDateTime) - Number(a.issueDateTime))
    .slice(0, 5);

  container.innerHTML = latestFive.length
    ? latestFive.map(t => `
            <div class="ticket-mini">
                <strong>${formatIssueType(t.issueType)}</strong>
                (${t.status})
            </div>
        `).join('')
    : '<em>No recent tickets</em>';
}

function renderTicketsInAgentDetails(tickets) {
  const container = document.getElementById('agent-tickets');
  if (!container) return;

  if (!tickets.length) {
    container.innerHTML = '<em>No tickets</em>';
    return;
  }

  container.innerHTML = tickets
    .slice(0, 5)
    .map(t => {
      const shortId = t.ticketId ? t.ticketId.substring(0, 4).toUpperCase() : '????';
      return `
            <div class="ticket-item" data-ticket-id="${t.ticketId}">
                <div style="display:flex; justify-content:space-between;">
                  <strong>${formatIssueType(t.issueType)}</strong>
                  <span style="font-size:11px; font-weight:700; color:var(--purple);">#${shortId}</span>
                </div>
                <span>(${t.status})</span><br>
                <small>${formatDateTime(t.issueDateTime)}</small>
            </div>
        `;
    })
    .join('');

  container.querySelectorAll('.ticket-item').forEach(ticketEl => {
    ticketEl.addEventListener('click', () => {
      const ticketId = ticketEl.dataset.ticketId;
      openTicketModal(ticketId);
    });
  });
}
//new Notification("Test Notification", { body: "Noti works" })

function notifyNewTicket({ agentId, issueType }) {
  console.log(' notifyNewTicket called', agentId, issueType);
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification("New Ticket Raised", {
      body: `Agent ${agentId} • ${issueType || 'Issue'}`,
    });
  }
}
async function getAttachmentsForTicket(ticketId) {
  // For now, return empty or mock as we are prioritizing core data migration
  return [];
}
function setupFilterHandlers() {
  const filter = document.getElementById('status-filter');
  const searchInput = document.getElementById('agent-search');
  const clearBtn = document.getElementById('clear-filters-btn');

  filter?.addEventListener('change', e => {
    saveFilter(STORAGE_KEYS.FILTER_STATUS, e.target.value);
    renderAgents();
  });

  searchInput?.addEventListener('input', () => {
    renderAgents();
  });

  clearBtn?.addEventListener('click', () => {
    clearAllFilters();
    if (filter) filter.value = '';
    if (searchInput) searchInput.value = '';
    renderAgents();
  });
}
function loadSavedFilters() {
  const filter = getAllFilters().status;
  const select = document.getElementById('status-filter');
  if (select && filter) select.value = filter;
}

function refreshSupervisorPanel() {
  loadAgents();
  loadTickets();
}

function renderQueueStats({ waitingCalls, activeAgents, slaPercent }) {
  const slaEl = document.getElementById('header-sla');
  const waitingEl = document.getElementById('header-waiting');
  const staffEl = document.getElementById('header-staff');

  if (slaEl) slaEl.textContent = `${slaPercent}%`;
  if (waitingEl) waitingEl.textContent = waitingCalls;
  if (staffEl) staffEl.textContent = activeAgents;

  // Also update legacy elements if they exist
  const oldSla = document.getElementById('slaPercent');
  if (oldSla) oldSla.textContent = `${slaPercent}%`;
}
function formatStatus(type) {
  if (!type) return;
  return type.replace('-', ' ').toUpperCase();
}
function formatIssueType(issueType) {
  if (!issueType) return '';
  return issueType.replace('-', ' ').toUpperCase();
}
function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}
function openTicketModal() {
  document.getElementById('ticket-modal').classList.remove('hidden');
  document.getElementById('ticket-modal-backdrop').classList.remove('hidden');
}

function closeTicketModal() {
  document.getElementById('ticket-modal').classList.add('hidden');
  document.getElementById('ticket-modal-backdrop').classList.add('hidden');
}
function formatDuration(ms) {
  if (!ms || ms < 0) return '0s';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
function handleProtocolStatus(protocol, status) {
  updateProtocolLED(protocol, status === 'connected');
}

async function handleForceLogout(agentId) {
  console.log('[Supervisor] Initiating REST + WS force logout for:', agentId);

  try {
    await forceLogoutAgent(agentId);

    // 📡 Broadcast force logout immediately
    sendMessage({ type: 'FORCE_LOGOUT', agentId });

    console.log('[Supervisor] Force logout command sent');
    alert(`Logout command sent for agent ${agentId}. They will be logged out immediately via WebSocket.`);
  } catch (err) {
    console.error('[Supervisor] Force logout failed:', err.message);
    alert('Failed to initiate force logout: ' + err.message);
  }
}





function runEventLoopDiagnostic() {
  console.clear();
  console.log('%c[DIAG] Sync start', 'color: cyan');

  // Microtask 1
  Promise.resolve().then(() => {
    console.log('%c[DIAG] Microtask: Promise.then', 'color: lime');
  });

  // Microtask 2
  queueMicrotask(() => {
    console.log('%c[DIAG] Microtask: queueMicrotask', 'color: lime');
  });

  // Macrotask 1
  setTimeout(() => {
    console.log('%c[DIAG] Macrotask: setTimeout', 'color: orange');
  }, 0);

  // Macrotask 2 
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    console.log('%c[DIAG] Macrotask: MessageChannel', 'color: orange');
  };
  channel.port2.postMessage(null);

  console.log('%c[DIAG] Sync end', 'color: cyan');
}
async function loadAgentNames() {
  try {
    const agents = await fetchAgents();
    const map = {};
    agents.forEach(a => {
      map[a.agentId] = a.name;
    });
    agentNameMap = map;
    console.log('[Supervisor] Agent names loaded', agentNameMap);
  } catch (err) {
    console.warn('[Supervisor] Failed to load agent names from API:', err.message);
  }
}





function setupModalHandlers() {
  const closeBtn = document.getElementById('close-ticket-modal');
  const backdrop = document.getElementById('ticket-modal-backdrop');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeTicketModal);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeTicketModal);
  }

  // Activity Log Handlers
  const activityBtn = document.getElementById('showActivityLogBtn');
  const activityCloseBtn = document.getElementById('closeActivityLogBtn');
  const activityOverlay = document.getElementById('activityLogOverlay');

  activityBtn?.addEventListener('click', async () => {
    activityOverlay?.classList.remove('hidden');
    await loadSupervisorActivity();
  });

  activityCloseBtn?.addEventListener('click', () => {
    activityOverlay?.classList.add('hidden');
  });

  // Also handle Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('ticket-modal');
      if (modal && !modal.classList.contains('hidden')) {
        closeTicketModal();
      }
      activityOverlay?.classList.add('hidden');
    }
  });
}

async function loadSupervisorActivity() {
  const authDataJson = sessionStorage.getItem('restro_auth');
  const authData = authDataJson ? JSON.parse(authDataJson) : {};
  const supervisorId = authData.id || 'admin';
  const tbody = document.getElementById('activity-log-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;">Loading activity...</td></tr>';

  try {
    const activity = await fetchSupervisorActivity(supervisorId);
    if (!activity || activity.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;">No activity found</td></tr>';
      return;
    }

    tbody.innerHTML = activity.map(t => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 10px;">${formatDateTime(t.issueDateTime)}</td>
        <td style="padding: 10px;">${t.ticketId.slice(0, 8)}...</td>
        <td style="padding: 10px;">${agentNameMap[t.agentId] || t.agentId}</td>
        <td style="padding: 10px;">${t.issueType}</td>
        <td style="padding: 10px;"><span class="status-badge-inline" data-status="${t.status.toLowerCase()}">${t.status}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('[Supervisor] Failed to load activity:', err);
    tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--accent-red);">Error loading activity</td></tr>';
  }
}
document.getElementById('diag-btn')
  ?.addEventListener('click', runEventLoopDiagnostic);

function setupAHTHandlers() {
  const showBtn = document.getElementById('showAHTBtn');
  const ahtOverlay = document.getElementById('ahtOverlay');
  const closeBtn = document.getElementById('closeAHTBtn');

  if (!showBtn || !ahtOverlay) return;

  function openAHT() {
    if (!hasAHTData) {
      alert('AHT not ready yet');
      return;
    }

    document.getElementById('globalAHT').textContent =
      formatSecondsToMinSec(cachedGlobalAHT);

    const container = document.getElementById('perAgentAHT');
    container.innerHTML = '';

    for (const agentId in cachedPerAgentAHT) {
      const label =
        agentId === 'null'
          ? 'Unassigned'
          : agentNameMap[agentId] ?? agentId;

      const row = document.createElement('div');
      row.textContent =
        `${label}: ${formatSecondsToMinSec(cachedPerAgentAHT[agentId])}`;
      container.appendChild(row);
    }

    ahtOverlay.classList.remove('hidden');
    isAHTVisible = true;
  }

  function closeAHT() {
    ahtOverlay.classList.add('hidden');
    isAHTVisible = false;
  }

  showBtn.addEventListener('click', openAHT);
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAHT();
  });

  const secondaryCloseBtn = document.getElementById('closeAHTBtnSecondary');
  secondaryCloseBtn?.addEventListener('click', closeAHT);

  // Close by clicking backdrop
  ahtOverlay.addEventListener('click', (e) => {
    if (e.target === ahtOverlay) {
      closeAHT();
    }
  });

  // Close via ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isAHTVisible) {
      closeAHT();
    }
  });
}
document.getElementById('create-ticket-btn')
  ?.addEventListener('click', async () => {

    const issueType =
      document.getElementById('new-issue-type').value.trim();
    const description =
      document.getElementById('new-description').value.trim();

    const agentId =
      document.getElementById('assign-agent-select')?.value || null;

    if (!issueType) {
      alert('Issue type required');
      return;
    }

    if (!agentId) {
      alert('Please select an agent to assign the ticket to.');
      return;
    }

    const authData = JSON.parse(sessionStorage.getItem('restro_auth') || '{}');
    const supervisorId = authData.id || 'admin';

    const ticket = {
      ticketId: crypto.randomUUID(),
      issueType,
      description,
      status: agentId ? 'ASSIGNED' : 'UNASSIGNED',
      agentId,
      assignedAgentId: agentId,
      createdBy: supervisorId,
      issueDateTime: Date.now(),
      resolvedAt: null,
      attachments: []
    };

    try {
      await apiCreateTicket(ticket);
      console.log('[SUPERVISOR] Ticket created and synced', ticket);

      // 📡 Broadcast assignment immediately
      sendMessage({
        type: 'ASSIGN_TICKET',
        agentId: ticket.agentId,
        payload: ticket
      });

      document.getElementById('new-issue-type').value = '';
      document.getElementById('new-description').value = '';
      document.getElementById('assign-agent-select').value = '';
      selectedAgentId = null;

      loadTickets();
    } catch (err) {
      console.error('Failed to create ticket:', err);
      alert('Failed to create ticket: ' + err.message);
    }
  });




