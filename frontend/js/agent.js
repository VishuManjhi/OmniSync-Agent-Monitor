import { setAgentId, getAgentId } from './utils/sessionStorage.js';
import { initTheme } from './utils/themeToggle.js';
import {
    saveAgentSession as apiSaveAgentSession,
    fetchCurrentSession as apiFetchCurrentSession,
    createOrUpdateTicket as apiCreateOrUpdateTicket,
    fetchAgentTickets as apiFetchAgentTickets,
    updateTicket as apiUpdateTicket,
    fetchAgent as apiFetchAgent
} from './api.js';
import { initWebSocket, sendMessage } from './comms/websocket.js';

let currentSession = null;
let breakInterval = null;
let selectedAttachFile = null;
let attachPreviewURL = null;
let forceLogoutHandled = false;
attachPreviewURL && URL.revokeObjectURL(attachPreviewURL);
attachPreviewURL = null;
let lastCompletedSession = null;
let isForceLoggedOut = false;

function setupAttachmentPreview() {
    const attachmentInput = document.getElementById('attachmentInput');
    const attachmentPreview = document.getElementById('attachmentPreview');

    if (!attachmentInput || !attachmentPreview) return;

    attachmentInput.addEventListener('change', () => {
        const file = attachmentInput.files[0] || null;

        selectedAttachFile = file;
        console.log('file selected', file);

        if (attachPreviewURL) {
            URL.revokeObjectURL(attachPreviewURL);
            attachPreviewURL = null;
        }

        if (!file) return;

        selectedAttachFile = file;
        attachPreviewURL = URL.createObjectURL(file);
        attachmentPreview.textContent = file.name;
    });
}
async function forceLogout() {
    if (isForceLoggedOut) return;

    console.warn('[AGENT] FORCE LOGOUT EXECUTED');

    isForceLoggedOut = true;
    forceLogoutHandled = true;

    // Stop timers
    if (breakInterval) {
        clearInterval(breakInterval);
        breakInterval = null;
    }

    // Kill session completely
    const session = currentSession;
    currentSession = null;
    lastCompletedSession = null;

    // Persist HARD logout
    if (session) {
        session.clockOutTime = Date.now();
        session.forceLoggedOut = true;

        try {
            await apiSaveAgentSession(session);
        } catch (err) {
            console.warn('[AGENT] Failed to sync force-logout to API:', err.message);
        }
    }

    // HARD UI RESET (no inference)
    document.getElementById('clock-in-time').textContent = '--:--:--';
    document.getElementById('session-status').textContent = 'OFFLINE';
    document.getElementById('break-duration').textContent = '00:00:00';

    updateButtons();
    updateStatusBadge('offline');

    alert('You were force logged out by supervisor');

    // FULL SIGN OUT
    sessionStorage.removeItem('restro_auth');
    window.location.replace('./login.html');
}



//inIt
async function initAgentDashboard() {
    forceLogoutHandled = false;

    // 1. Get ID from URL first (Login source of truth)
    const params = new URLSearchParams(window.location.search);
    const urlAgentId = params.get('agentId');

    if (urlAgentId) {
        setAgentId(urlAgentId.toLowerCase());
    }

    // 2. Fallback to storage
    let agentId = getAgentId();

    if (!agentId) {
        // Last resort fallback
        agentId = 'a1';
        setAgentId(agentId);
    }

    document.getElementById('current-agent-id').textContent = agentId;

    // Fetch and Show Agent Name
    try {
        const agentProfile = await apiFetchAgent(agentId);
        const nameEl = document.getElementById('agent-display-name');
        if (nameEl && agentProfile?.name) {
            nameEl.textContent = agentProfile.name;
        } else if (nameEl) {
            nameEl.textContent = 'Agent Profile';
        }
    } catch (e) {
        console.warn('[AGENT] Could not fetch name from API', e);
        document.getElementById('agent-display-name').textContent = 'Agent Profile';
    }

    await loadCurrentSession(agentId);
    await loadMyTickets();
    setupEventHandlers();
    setupAttachmentPreview();

    // Initialize Real-time signaling
    initWebSocket((data) => {
        if (data.type === 'FORCE_LOGOUT' && data.agentId === agentId) {
            forceLogout();
        }
        if (data.type === 'ASSIGN_TICKET' && data.agentId === agentId) {
            loadMyTickets();
            // Optional: browser notification
        }
    });

    // Notify supervisor we are online/current status
    sendMessage({ type: 'AGENT_STATUS', agentId });

    //  REST-Only Status Polling (Safety net for commands)
    setInterval(async () => {
        if (!agentId || isForceLoggedOut) return;

        try {
            const session = await apiFetchCurrentSession(agentId);
            if (session && session.forceLoggedOut) {
                console.warn('[AGENT] Force logout detected via polling');
                forceLogout();
            }
        } catch (err) {
            console.error('[AGENT] Polling check failed:', err.message);
        }
    }, 5000);
}

//uiHelpers
function deriveSessionStatus(session) {
    if (!session) return 'offline';
    if (session.clockOutTime) return 'offline';

    const lastBreak = session.breaks?.at(-1);
    if (lastBreak && !lastBreak.breakOut) return 'on-break';

    if (session.onCall) return 'on-call';

    return 'active';
}
function updateSessionUI() {
    const session = currentSession || lastCompletedSession;
    if (!session) {
        document.getElementById('clock-in-time').textContent = '--:--:--';
        document.getElementById('session-status').textContent = 'Not Clocked In';
        document.getElementById('break-duration').textContent = '00:00:00';
        return;
    }

    document.getElementById('clock-in-time').textContent =
        session.clockInTime
            ? new Date(session.clockInTime).toLocaleTimeString()
            : '--:--:--';

    const status = deriveSessionStatus(session);

    document.getElementById('session-status').textContent =
        status.replace('-', ' ').toUpperCase();

}
function updateButtons() {
    const status = deriveSessionStatus(currentSession);

    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const breakInBtn = document.getElementById('break-in-btn');
    const breakOutBtn = document.getElementById('break-out-btn');

    if (status === 'offline') {
        clockInBtn.disabled = false;
        clockOutBtn.disabled = true;
        breakInBtn.disabled = true;
        breakOutBtn.disabled = true;
        return;
    }

    if (status === 'active' || status === 'on-call') {
        clockInBtn.disabled = true;
        clockOutBtn.disabled = false;
        breakInBtn.disabled = false;
        breakOutBtn.disabled = true;
        return;
    }

    if (status === 'on-break') {
        clockInBtn.disabled = true;
        clockOutBtn.disabled = true;
        breakInBtn.disabled = true;
        breakOutBtn.disabled = false;
        return;
    }
}

function updateStatusBadge(status) {
    const badge = document.getElementById('status-badge');
    if (!badge) return;

    if (!status) {
        badge.textContent = 'OFFLINE';
        return;
    }
    badge.textContent = String(status).toUpperCase();
}


function startBreakTimer() {
    if (breakInterval) return;

    breakInterval = setInterval(() => {
        const lastBreak = currentSession?.breaks?.at(-1);
        if (!lastBreak || lastBreak.breakOut) return;

        const start = lastBreak.breakIn();
        const now = Date.now();
        const diff = now - start;

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        document.getElementById('break-duration').textContent =
            `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);
}
async function updateTicket(ticketId, updater) {
    try {
        const tickets = await apiFetchAgentTickets(getAgentId());
        const ticket = tickets.find(t => t.ticketId === ticketId);

        if (!ticket) {
            console.error('[AGENT] Ticket NOT FOUND on API:', ticketId);
            return;
        }

        updater(ticket);

        await apiUpdateTicket(ticket.ticketId, {
            status: ticket.status,
            resolvedAt: ticket.resolvedAt ?? null,
            rejectionReason: ticket.rejectionReason ?? null,
            rejectedAt: ticket.rejectedAt ?? null,
            assignedAgentId: ticket.assignedAgentId ?? null,
            startedAt: ticket.startedAt ?? null,
            resolutionRequestedAt: ticket.resolutionRequestedAt ?? null
        });

        console.log('[AGENT] Ticket updated & synced:', ticketId, ticket.status);
        loadMyTickets();
    } catch (err) {
        console.warn('[AGENT] Failed to update/sync ticket:', err.message);
    }
}

//sessionLoad

async function loadCurrentSession(agentId) {
    currentSession = null;
    if (isForceLoggedOut) {
        console.warn('[AGENT] Session load blocked due to force logout');
        updateStatusBadge('offline');
        updateButtons();
        return;
    }

    try {
        const session = await apiFetchCurrentSession(agentId);
        currentSession = session || null;
    } catch (err) {
        console.warn('[AGENT] Failed to fetch current session from API:', err.message);
        currentSession = null;
    }

    updateSessionUI();
    updateButtons();
    updateStatusBadge(deriveSessionStatus(currentSession));

    const lastBreak = currentSession?.breaks?.at(-1);
    if (lastBreak && !lastBreak.breakOut) {
        startBreakTimer();
    }
}
//tickets
async function handleTicketSubmit(e) {
    e.preventDefault();
    console.log('selectedAttachFile:', selectedAttachFile);
    console.log('handleTicketSubmit fired');

    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const ticket = {
        ticketId: crypto.randomUUID(),
        agentId: getAgentId(),
        issueType: form.get('issueType'),
        description: form.get('description'),
        status: 'IN_PROGRESS',
        issueDateTime: Date.now(),
        resolvedAt: null,
        callDuration: Number(form.get('callDuration')) || null,
        attachments: []
    };

    if (selectedAttachFile) {
        try {
            const base64Content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(selectedAttachFile);
            });

            ticket.attachments.push({
                attachmentId: crypto.randomUUID(),
                fileName: selectedAttachFile.name,
                type: selectedAttachFile.type,
                size: selectedAttachFile.size,
                content: base64Content
            });
        } catch (err) {
            console.error('Failed to process attachment:', err);
        }
    }

    try {
        await apiCreateOrUpdateTicket(ticket);
        console.log('Ticket synced', ticket.ticketId);
        formEl.reset();
        selectedAttachFile = null;
        const attachmentPreview = document.getElementById('attachmentPreview');
        if (attachmentPreview) attachmentPreview.textContent = '';

        loadMyTickets();
        alert('Ticket raised successfully');
    } catch (err) {
        console.error('Ticket submission failed', err);
        alert('Failed to raise ticket: ' + err.message);
    }
}
async function loadMyTickets() {
    const agentId = getAgentId();
    if (!agentId) return;

    try {
        const tickets = await apiFetchAgentTickets(agentId);
        tickets.sort((a, b) => Number(b.issueDateTime) - Number(a.issueDateTime));
        renderMyTickets(tickets);
    } catch (err) {
        console.warn('[AGENT] Failed to load tickets from API:', err.message);
    }
}

function renderMyTickets(tickets) {
    const container = document.getElementById("my-tickets");
    if (!container) return;

    container.innerHTML = tickets.length
        ? tickets.map(t => {
            const dateStr = new Date(t.issueDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
            <div class="ticket-card" data-id="${t.ticketId}">
                <strong>#${t.ticketId.substring(0, 4).toUpperCase()} — ${t.issueType}</strong>
                <p>${t.description || "No additional case details provided."}</p>
                <div class="ticket-status-row">
                    <span class="status-badge" style="background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.2); color: #60a5fa;">
                        ${t.status}
                    </span>
                    <span style="font-size: 11px; opacity: 0.5; font-weight: 700;">${dateStr}</span>
                </div>
                <div style="margin-top: 16px;">
                    ${t.status === "ASSIGNED"
                    ? `<button class="action-btn btn-primary start-btn" style="width:100%; font-size:11px; padding:10px;">Start Resolution</button>`
                    : t.status === "IN_PROGRESS"
                        ? `<button class="action-btn btn-warning resolve-btn" style="width:100%; font-size:11px; padding:10px;">Request Resolution</button>`
                        : t.status === "RESOLUTION_REQUESTED"
                            ? `<button class="action-btn resolve-btn" disabled style="width:100%; font-size:11px; padding:10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.3);">Awaiting Approval</button>`
                            : ""
                }
                </div>
            </div>
        `;
        }).join("")
        : '<div class="empty-state">No service tickets synchronized for this profile yet.</div>';
}



//clocks
async function handleClockIn() {
    const agentId = getAgentId();
    if (!agentId) return;

    if (currentSession) return;

    forceLogoutHandled = false;

    currentSession = {
        sessionID: crypto.randomUUID(),
        agentId,
        clockInTime: Date.now(),
        clockOutTime: null,
        breaks: [],
        onCall: false
    };

    try {
        await apiSaveAgentSession(currentSession);
        sendMessage({
            type: 'AGENT_STATUS_CHANGE',
            agentId: currentSession.agentId,
            status: deriveSessionStatus(currentSession)
        });
    } catch (err) {
        console.warn('[AGENT] Failed to sync clock-in to API:', err.message);
    }

    updateSessionUI();
    updateButtons();
    updateStatusBadge(deriveSessionStatus(currentSession));
}

async function handleClockOut() {
    if (!currentSession) return;

    currentSession.clockOutTime = Date.now();
    const snapshot = { ...currentSession };

    lastCompletedSession = snapshot;
    currentSession = null;

    updateSessionUI();
    updateButtons();
    updateStatusBadge('offline');

    try {
        await apiSaveAgentSession(snapshot);
        sendMessage({
            type: 'AGENT_STATUS_CHANGE',
            agentId: snapshot.agentId,
            status: 'offline'
        });
    } catch (err) {
        console.warn('[AGENT] Failed to sync session to API:', err.message);
    }
}

//on-call
async function handleOnCallToggle() {
    if (!currentSession) return;

    currentSession.onCall = !currentSession.onCall;

    updateSessionUI();
    updateButtons();
    updateStatusBadge(deriveSessionStatus(currentSession));

    try {
        await apiSaveAgentSession(currentSession);
        sendMessage({
            type: 'AGENT_STATUS_CHANGE',
            agentId: currentSession.agentId,
            status: deriveSessionStatus(currentSession)
        });
    } catch (err) {
        console.warn('[AGENT] Failed to sync session to API:', err.message);
    }
}
//brekas

async function handleBreakIn() {
    if (!currentSession) return;

    currentSession.clockOutTime = null;

    const lastBreak = currentSession.breaks.at(-1);
    if (lastBreak && !lastBreak.breakOut) return;

    currentSession.breaks.push({
        breakIn: Date.now(),
        breakOut: null
    });

    startBreakTimer();
    updateSessionUI();
    updateButtons();
    updateStatusBadge(deriveSessionStatus(currentSession));

    try {
        await apiSaveAgentSession(currentSession);
        sendMessage({
            type: 'AGENT_STATUS_CHANGE',
            agentId: currentSession.agentId,
            status: deriveSessionStatus(currentSession)
        });
    } catch (err) {
        console.warn('[AGENT] Failed to sync session to API:', err.message);
    }
}

async function handleBreakOut() {
    if (!currentSession) return;

    const lastBreak = currentSession.breaks.at(-1);
    if (!lastBreak || lastBreak.breakOut) return;

    lastBreak.breakOut = Date.now();

    stopBreakTimer();
    updateSessionUI();
    updateButtons();
    updateStatusBadge(deriveSessionStatus(currentSession));

    try {
        await apiSaveAgentSession(currentSession);
        sendMessage({
            type: 'AGENT_STATUS_CHANGE',
            agentId: currentSession.agentId,
            status: deriveSessionStatus(currentSession)
        });
    } catch (err) {
        console.warn('[AGENT] Failed to sync session to API:', err.message);
    }
}
function stopBreakTimer() {
    clearInterval(breakInterval);
    breakInterval = null;
    const el = document.getElementById('break-duration');
    if (el) {
        el.textContent = '00:00:00';
    }
}

// WebSocket command handler removed: the app now uses REST + MongoDB only.



//events

function setupEventHandlers() {
    document.getElementById('clock-in-btn')
        ?.addEventListener('click', handleClockIn);

    document.getElementById('clock-out-btn')
        ?.addEventListener('click', handleClockOut);

    document.getElementById('break-in-btn')
        ?.addEventListener('click', handleBreakIn);

    document.getElementById('break-out-btn')
        ?.addEventListener('click', handleBreakOut);
    document.getElementById('on-call-btn')
        ?.addEventListener('click', handleOnCallToggle);



    const ticketForm = document.getElementById('ticket-form');
    if (!ticketForm) {
        console.error(' ticket-form not found');
        return;
    }

    ticketForm.addEventListener('submit', handleTicketSubmit);


    const myTickets = document.getElementById('my-tickets');
    if (myTickets) {
        myTickets.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const card = btn.closest('.ticket-card');
            if (!card) return;

            const ticketId = card.dataset.id;
            console.log('[AGENT] Ticket click:', ticketId, btn.className);

            if (btn.classList.contains('start-btn')) {
                if (!currentSession) {
                    alert('You are offline. Clock in to start work.');
                    return;
                }
                if (!currentSession) {
                    alert('You must be clocked in to resolve tickets');
                    return;
                }
                const status = deriveSessionStatus(currentSession);
                if (status !== 'active') {
                    alert(`Cannot start work while ${status.replace('-', ' ')}`);
                    return;
                }
                updateTicket(ticketId, (ticket) => {
                    if (ticket.status !== 'ASSIGNED') return;

                    ticket.status = 'IN_PROGRESS';
                    ticket.startedAt = Date.now();
                });
            }

            if (btn.classList.contains('resolve-btn')) {
                if (!currentSession) {
                    alert('You are offline. Cannot resolve tickets.');
                    return;
                }
                console.log('[Agent] Resolve Button Detected');

                updateTicket(ticketId, (ticket) => {
                    if (ticket.status === 'RESOLVED') return;

                    // Supervisor-assigned → approval required
                    if (ticket.assignedBy === 'SUPERVISOR') {
                        if (!ticket.startedAt) {
                            ticket.startedAt = ticket.issueDateTime;
                        }

                        ticket.status = 'RESOLUTION_REQUESTED';
                        ticket.resolutionRequestedAt = Date.now();
                        return;
                    }

                    //Agent-raised → resolve directly
                    ticket.status = 'RESOLVED';
                    ticket.resolvedAt = Date.now();
                });

            }
        });
    }
}







//boot

document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initAgentDashboard)
    : initAgentDashboard();

//window.__testHandleWSCommand = handleWSCommand;
