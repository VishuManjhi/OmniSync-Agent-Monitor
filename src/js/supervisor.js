import { getAllFilters, saveFilter, clearAllFilters, STORAGE_KEYS } from './utils/sessionStorage.js';
import { openDB } from './db.js';
import * as state from './state.js';
import { agentCardTimers, highlightedAgentCards } from './utils/uiWeakState.js';
import { initWebSocket } from './comms/websocket.js';
import { startSSE } from './comms/sse.js';
import { updateProtocolLED } from './utils/connectionLED.js';



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
const queueMetrics = {
    queueDepth: 0,
    waitingCalls: 0,
    activeAgents: 0,
    slaPercent: 0
};
function renderQueueStats(stats) {
    queueMetrics.queueDepth = stats.queueDepth;
    queueMetrics.waitingCalls = stats.waitingCalls;
    queueMetrics.activeAgents = stats.activeAgents;
    queueMetrics.slaPercent = stats.slaPercent;

    document.getElementById('queueDepth').textContent = queueMetrics.queueDepth;
    document.getElementById('waitingCalls').textContent = queueMetrics.waitingCalls;
    document.getElementById('activeAgents').textContent = queueMetrics.activeAgents;
    document.getElementById('slaPercent').textContent = queueMetrics.slaPercent + '%';
}


//window.__debug = { agentCardTimers, highlightedAgentCards }; //debug.agentCardTimers
let selectedAgentId = null;
let db = null;
let allAgents = [];
let activeHighlightedCard = null;
let isWSRefresh = false;

export async function initialize(database) {
    db = database;

    const storedAgentId = sessionStorage.getItem('monitoredAgentId');
    if (storedAgentId) {
        selectedAgentId = storedAgentId;
    }
    if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
    }
    initWebSocket(handleWSMessage);

    startSSE(handleProtocolStatus, renderQueueStats);


    loadSavedFilters();          
    setupFilterHandlers();       
    AgentGridDelegation(); 
   refreshSupervisorPanel();
   initWebSocket(handleWSMessage);
   
   //setInterval(refreshSupervisorPanel, 5000);
}

function loadAgents() {
    const tx = db.transaction(['agent_sessions'], 'readonly');
    const store = tx.objectStore('agent_sessions');

    const sessions = [];

    store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            const session = normalizeSession(cursor.value);

            if (session.clockInTime) {
                sessions.push(session);
            }

            cursor.continue();
        } else {
            processSessions(sessions);
        }
    };
}


function processSessions(sessions) {
    const map = new Map();

    sessions.forEach(s => {
        const prev = map.get(s.agentId);
        if (!prev) {
            map.set(s.agentId, s);
            return;
        }
        if (prev.clockOutTime && !s.clockOutTime) {
            map.set(s.agentId, s);
            return;
        }

        const prevTime = new Date(prev.clockInTime || 0).getTime();
        const currTime = new Date(s.clockInTime || 0).getTime();

        if (currTime > prevTime) {
            map.set(s.agentId, s);
        }
    });

    allAgents = Array.from(map.values()).map(session => ({
        agentId: session.agentId,
        state: deriveAgentState(session),
        clockInTime: session.clockInTime,
        clockOutTime: session.clockOutTime,
        session
    }));

    renderAgents();
    if (selectedAgentId) renderAgentDetails(selectedAgentId);
}


function renderAgents() {
    const filter = getAllFilters().status;
    let agents = allAgents;

    if (filter) {
        agents = agents.filter(a => a.state === filter);
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
    if (selectedAgentId && !agents.some(a => a.agentId === selectedAgentId)) {
    selectedAgentId = null;
    document.getElementById('agent-info').innerHTML = '<em>Select an agent</em>';
    document.getElementById('agent-tickets').innerHTML = '';
     }

}

function AgentGridDelegation() {
    const grid = document.getElementById('agent-grid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.agent-card');
        if (!card || !grid.contains(card)) return;

        handleAgentCardClick(card);
    });
}
function handleAgentCardClick(cardEl) {
    const agentId = cardEl.dataset.agentId;
    selectedAgentId = agentId;

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

function handleWSMessage(message) {
    console.log('[WS MESSAGE]', message);

    isWSRefresh = true;

    refreshSupervisorPanel();
    loadTickets();
    if (message.type === 'TICKET_CREATED') {
    notifyNewTicket({
        agentId: message.agentId,
        issueType: message.issueType
     });
    }
    if (selectedAgentId) {
        renderAgentDetails(selectedAgentId);

        setTimeout(() => {
            loadTicketsForAgent(selectedAgentId);
            isWSRefresh = false;
        }, 0);
    } else {
        isWSRefresh = false;
    }
}

function loadTickets() {
    const tx = db.transaction(['tickets'], 'readonly');
    const store = tx.objectStore('tickets');

    const tickets = [];

    store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            tickets.push(normalizeTicket(cursor.value));
            cursor.continue();
        } else {
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
        }
    };
}




function createAgentCard(agent) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.dataset.agentId = agent.agentId;

    card.innerHTML = `
    <strong>${agent.agentId}</strong><br>
    Status: ${formatStatus(agent.state)}<br>
    Clock In: ${formatDateTime(agent.clockInTime)}<br>
    Clock Out: ${formatDateTime(agent.clockOutTime)}<br>
    <span class="duration">--</span>
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

    panel.innerHTML = latest.map(t => `
    <div 
        class="ticket-card"
        data-ticket-id="${t.ticketId}"
        style="cursor:pointer">  
        <strong>Agent:</strong> ${t.agentId}<br>
        <strong>Issue:</strong> ${formatIssueType(t.issueType)}<br>
        <strong>Status:</strong> ${t.status}<br>
        <small>${formatDateTime(t.issueDateTime)}</small>
        <p>${t.description || ''}</p>
     </div>
    `).join('');
    panel.querySelectorAll('.ticket-card').forEach(el => {
    el.addEventListener('click', async () => {
        const ticketId = el.dataset.ticketId;
        const ticket = tickets.find(t => t.ticketId === ticketId);
        if (!ticket) return;

        await renderTicketModal(ticket);
     });
    });
}
function renderAgentDetails(agentId) {
    const agent = allAgents.find(a => a.agentId === agentId);
    if (!agent) return;

    const container = document.getElementById('agent-info');
    const breaks = agent.session?.breaks || [];

    container.innerHTML = `
        <strong>Agent ID:</strong> ${agent.agentId}<br>
        <strong>Status:</strong> ${formatStatus(agent.state)}<br>
        <strong>Clock In:</strong> ${formatDateTime(agent.clockInTime)}<br>
        <strong>Clock Out:</strong> ${formatDateTime(agent.clockOutTime)}<br>
        <strong>Breaks:</strong>
        ${
            breaks.length === 0
                ? '<div><em>No breaks taken</em></div>'
                : breaks.map(b => {
                    const start = new Date(b.breakIn).getTime();
                    const end = b.breakOut
                        ? new Date(b.breakOut).getTime()
                        : Date.now();

                    const duration = formatDuration(end - start);

                    return `
                        <div style="font-size:13px; margin-top:4px">
                            • ${formatDateTime(b.breakIn)}
                            →
                            ${b.breakOut ? formatDateTime(b.breakOut) : '<em>ongoing</em>'}
                            <span style="opacity:0.7"> (${duration})</span>
                        </div>
                    `;
                }).join('')
        }
    `;
}



function loadTicketsForAgent(agentId) {
    const tx = db.transaction(['tickets'], 'readonly');
    const store = tx.objectStore('tickets');

    const tickets = [];

    store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;

        if (cursor) {
            const ticket = normalizeTicket(cursor.value);

            if (ticket.agentId === agentId) {
                tickets.push(ticket);
            }

            cursor.continue();
        } else {
            tickets.sort(
                (a, b) => new Date(b.issueDateTime) - new Date(a.issueDateTime)
            );

            renderTicketsInAgentDetails(tickets);
        }
    };
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
        .map(t => `
            <div class="ticket-item" data-ticket-id="${t.ticketId}">
                <strong>${formatIssueType(t.issueType)}</strong>
                <span>(${t.status})</span><br>
                <small>${formatDateTime(t.issueDateTime)}</small>
            </div>
        `)
        .join('');

    container.querySelectorAll('.ticket-item').forEach(ticketEl => {
        ticketEl.addEventListener('click', () => {
            const ticketId = ticketEl.dataset.ticketId;
            openTicketModal(ticketId);
        });
    });
}
//new Notification("Test Notification", { body: "Notification works" })

function notifyNewTicket({ agentId, issueType }) {
    console.log(' notifyNewTicket called', agentId, issueType);
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification("New Ticket Raised", {
            body: `Agent ${agentId} • ${issueType || 'Issue'}`,
            icon: "/favicon.ico" // optional
        });
    }
}

async function getAttachmentsForTicket(ticketId) {
    const db = await openDB();

    return new Promise((resolve) => {
        const tx = db.transaction(['attachments'], 'readonly');
        const store = tx.objectStore('attachments');
        const index = store.index('ticketId');

        const attachments = [];

        index.openCursor(IDBKeyRange.only(ticketId)).onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                attachments.push(cursor.value);
                cursor.continue();
            } else {
                resolve(attachments);
            }
        };
    });
}
function setupFilterHandlers() {
    const filter = document.getElementById('status-filter');
    const clearBtn = document.getElementById('clear-filters-btn');

    filter?.addEventListener('change', e => {
        saveFilter(STORAGE_KEYS.FILTER_STATUS, e.target.value);
        renderAgents();
    });

    clearBtn?.addEventListener('click', () => {
        clearAllFilters();
        filter.value = '';
        renderAgents();
    });
}

function loadSavedFilters() {
    const filter = getAllFilters().status;
    const select = document.getElementById('status-filter');
    if (select && filter) select.value = filter;
}

function refreshSupervisorPanel() {
    allAgents = [];
    loadAgents();
    loadTickets();
}

function formatStatus(type) {
    if(!type) return;
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



document.getElementById('close-ticket-modal')
    ?.addEventListener('click', closeTicketModal);

document.getElementById('ticket-modal-backdrop')
    ?.addEventListener('click', closeTicketModal);
document.getElementById('go-agent-btn')
  ?.addEventListener('click', () => {window.location.href = 'agent.html';});



