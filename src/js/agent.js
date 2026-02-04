import { openDB } from './db.js';
import { setAgentId, getAgentId } from './utils/sessionStorage.js';
import { initWebSocket, sendMessage } from './comms/websocket.js';
import { initBroadcast, broadcastMessage } from './comms/broadcast.js';
import { startLongPolling } from './comms/longPoll.js';

let db = null;
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

        const tx = db.transaction(['agent_sessions'], 'readwrite');
        tx.objectStore('agent_sessions').put(session);
        await new Promise(res => tx.oncomplete = res);
    }

    // HARD UI RESET (no inference)
    document.getElementById('clock-in-time').textContent = '--:--:--';
    document.getElementById('session-status').textContent = 'OFFLINE';
    document.getElementById('break-duration').textContent = '00:00:00';

    updateButtons();
    updateStatusBadge('offline');

    // Notify supervisor
    sendMessage({
        type: 'AGENT_STATUS_CHANGED',
        agentId: getAgentId(),
        status: 'offline'
    });

    alert('You were force logged out by supervisor');

    // 🛡️ FULL SIGN OUT
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

    initWebSocket(handleWSCommand);
    startLongPolling(handleWSCommand);

    db = await openDB();

    // 🏷️ Fetch and Show Agent Name
    try {
        const tx = db.transaction(['agents'], 'readonly');
        const store = tx.objectStore('agents');
        const req = store.get(agentId);
        req.onsuccess = () => {
            const agentProfile = req.result;
            const nameEl = document.getElementById('agent-display-name');
            if (nameEl && agentProfile?.name) {
                nameEl.textContent = agentProfile.name;
            } else if (nameEl) {
                nameEl.textContent = 'Agent Profile';
            }
        };
    } catch (e) {
        console.warn('[AGENT] Could not fetch name from DB', e);
        document.getElementById('agent-display-name').textContent = 'Agent Profile';
    }

    await loadCurrentSession(agentId);
    loadMyTickets();
    setupEventHandlers();
    setupAttachmentPreview();
    initBroadcast((msg) => { });

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
function updateTicket(ticketId, updater) {
    const tx = db.transaction(['tickets'], 'readwrite');
    const store = tx.objectStore('tickets');

    store.get(ticketId).onsuccess = (e) => {
        const ticket = e.target.result;
        console.log('[AGENT] Fetched ticket from DB:', ticket);

        if (!ticket) {
            console.error('[AGENT] Ticket NOT FOUND in IndexedDB:', ticketId);
            return;
        }

        updater(ticket);

        store.put(ticket).onsuccess = () => {
            console.log('[AGENT] Ticket updated & saved:', ticketId, ticket.status);

            sendMessage({
                type: 'TICKET_UPDATED',
                ticketId: ticket.ticketId,
                agentId: ticket.agentId,
                status: ticket.status
            });

            broadcastMessage({
                type: 'TICKET_UPDATED',
                ticketId: ticket.ticketId,
                agentId: ticket.agentId,
                status: ticket.status
            });

            loadMyTickets();
        };

    };
}

//sessionLoad

async function loadCurrentSession(agentId) {
    currentSession = null;
    if (isForceLoggedOut) {
        console.warn('[AGENT] Session load blocked due to force logout');
        updateStatusBadge('offline');
        updateButtons();
    }

    const tx = db.transaction(['agent_sessions'], 'readonly');
    const store = tx.objectStore('agent_sessions');
    const index = store.index('agentId');

    const sessions = [];

    index.openCursor(IDBKeyRange.only(agentId)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            const s = cursor.value;
            if (s.forceLoggedOut === true) {
                return;
            }
            if (s.clockInTime && !s.clockOutTime) {
                sessions.push(s);
            }
            cursor.continue();
        } else {
            if (!sessions.length) {
                updateSessionUI();
                updateButtons();
                updateStatusBadge(deriveSessionStatus(currentSession));
                return;
            }
            sessions.sort(
                (a, b) => new Date(b.clockInTime) - new Date(a.clockInTime)
            );

            currentSession = sessions[0];

            updateSessionUI();
            updateButtons();
            updateStatusBadge(deriveSessionStatus(currentSession));

            const lastBreak = currentSession.breaks?.at(-1);
            if (lastBreak && !lastBreak.breakOut) {
                startBreakTimer();
            }
        }
    };
}
//tickets
function handleTicketSubmit(e) {
    e.preventDefault();
    console.log('selectedAttachFile:', selectedAttachFile);
    console.log('handleTicketSubmit fired');

    if (!db) {
        console.error('DB not ready');
        return;
    }

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

    const tx = db.transaction(['tickets', 'attachments'], 'readwrite');
    const ticketStore = tx.objectStore('tickets');
    const attachmentStore = tx.objectStore('attachments');


    ticketStore.add(ticket).onsuccess = () => {
        console.log('Ticket saved', ticket.ticketId);
        /*sendMessage({
        type: 'TICKET_CREATED',
        agentId: ticket.agentId,
        ticketId: ticket.ticketId
     });*/
        sendMessage({
            type: 'TICKET_CREATED',
            agentId: ticket.agentId,
            ticketId: ticket.ticketId,
            issueType: ticket.issueType
        });
        broadcastMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId: ticket.agentId,
            ticketId: ticket.ticketId,
            issueType: ticket.issueType
        })
        formEl.reset();
        loadMyTickets();
    };
    alert(' Ticket raised successfully');

    ticketStore.onerror = (e) => {
        console.error(' Ticket save failed', e.target.error);
    };
    if (selectedAttachFile) {
        const attachment = {
            attachmentId: crypto.randomUUID(),
            ticketId: ticket.ticketId,
            agentId: ticket.agentId,
            fileName: selectedAttachFile.name,
            type: selectedAttachFile.type,
            size: selectedAttachFile.size,
            blob: selectedAttachFile,
        };
        attachmentStore.add(attachment);
        tx.oncomplete = () => {
            console.log('Ticket + attachment transaction committed');
        };
    }

}
function loadMyTickets() {
    const agentId = getAgentId();
    if (!agentId || !db) return;

    const tx = db.transaction(['tickets'], 'readonly');
    const store = tx.objectStore('tickets');
    const index = store.index('agentId');

    const tickets = [];

    index.openCursor(IDBKeyRange.only(agentId)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            if (cursor.value.agentId === agentId) {
                tickets.push(cursor.value);
            }
            cursor.continue();
        } else {
            tickets.sort((a, b) => Number(b.issueDateTime) - Number(a.issueDateTime));
            renderMyTickets(tickets);
        }
    };
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

    await saveSession(currentSession);

    sendMessage({
        type: 'AGENT_STATUS_CHANGED',
        agentId,
        status: 'active'
    });
    broadcastMessage({
        type: 'AGENT_STATUS_CHANGED',
        agentId
    })

    updateSessionUI();
    updateButtons();
    updateStatusBadge(deriveSessionStatus(currentSession));
}

function handleClockOut() {
    if (!currentSession) return;

    const agentId = currentSession.agentId; //  snapshot

    currentSession.clockOutTime = Date.now();

    const tx = db.transaction(['agent_sessions'], 'readwrite');
    const store = tx.objectStore('agent_sessions');

    store.put(currentSession).onsuccess = () => {
        const snapshot = { ...currentSession };

        lastCompletedSession = snapshot
        currentSession = null;

        updateSessionUI();
        updateButtons();
        updateStatusBadge('offline');

        sendMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId,
            session: snapshot
        });

        broadcastMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId,
            session: snapshot
        });
    };
}

//on-call
function handleOnCallToggle() {
    if (!currentSession) return;

    currentSession.onCall = !currentSession.onCall;

    const tx = db.transaction(['agent_sessions'], 'readwrite');
    tx.objectStore('agent_sessions').put(currentSession).onsuccess = () => {
        updateSessionUI();
        updateButtons();
        updateStatusBadge(deriveSessionStatus(currentSession));

        sendMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId: currentSession.agentId
        });
        broadcastMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId: currentSession.agentId
        })
    };
}
//brekas

function handleBreakIn() {
    if (!currentSession) return;

    currentSession.clockOutTime = null;

    const lastBreak = currentSession.breaks.at(-1);
    if (lastBreak && !lastBreak.breakOut) return;

    currentSession.breaks.push({
        breakIn: Date.now(),
        breakOut: null
    });

    const tx = db.transaction(['agent_sessions'], 'readwrite');
    tx.objectStore('agent_sessions').put(currentSession).onsuccess = () => {
        startBreakTimer();
        updateSessionUI();
        updateButtons();
        updateStatusBadge(deriveSessionStatus(currentSession));

        sendMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId: currentSession.agentId
        });
        broadcastMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId: currentSession.agentId
        })
    };
}

function handleBreakOut() {
    if (!currentSession) return;

    const lastBreak = currentSession.breaks.at(-1);
    if (!lastBreak || lastBreak.breakOut) return;

    lastBreak.breakOut = Date.now();

    const tx = db.transaction(['agent_sessions'], 'readwrite');
    tx.objectStore('agent_sessions').put(currentSession).onsuccess = () => {
        stopBreakTimer();
        updateSessionUI();
        updateButtons();
        updateStatusBadge(deriveSessionStatus(currentSession));

        sendMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId: currentSession.agentId
        });
        broadcastMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId: currentSession.agentId
        })
    };
}
function stopBreakTimer() {
    clearInterval(breakInterval);
    breakInterval = null;
    const el = document.getElementById('break-duration');
    if (el) {
        el.textContent = '00:00:00';
    }
}
async function handleWSCommand(cmd) {
    if (!cmd || !cmd.type) return;

    const myId = getAgentId();

    switch (cmd.type) {



        case 'AGENT_STATUS_CHANGED': {
            break;
        }

        /* =========================
           FORCE LOGOUT
        ========================= */
        case 'FORCE_LOGOUT': {
            if (cmd.agentId !== myId) return;

            if (forceLogoutHandled) {
                console.log('[AGENT] FORCE_LOGOUT already handled, ignoring');
                return;
            }

            forceLogoutHandled = true;

            console.warn('[AGENT] Forced logout by supervisor');
            await forceLogout();
            break;
        }

        /* =========================
           ASSIGN TICKET
        ========================= */
        case 'ASSIGN_TICKET': {
            if (cmd.agentId !== myId) return;

            console.warn('[AGENT] Ticket assigned by supervisor', cmd.payload);

            const ticket = {
                ...cmd.payload,
                agentId: myId,
                status: 'ASSIGNED',
                assignedBy: 'SUPERVISOR'
            };

            const tx = db.transaction(['tickets'], 'readwrite');
            const store = tx.objectStore('tickets');

            store.put(ticket).onsuccess = () => {
                console.log('[AGENT] Assigned ticket saved', ticket.ticketId);
                loadMyTickets();
            };

            break;
        }

        /* =========================
           RESOLUTION APPROVED
        ========================= */
        case 'RESOLUTION_APPROVED': {
            if (cmd.agentId !== myId) break;

            // ✅ agent must be online
            if (!currentSession) {
                console.warn('[AGENT] Approval ignored, agent offline');
                break;
            }

            console.warn('[AGENT] Resolution approved for ticket', cmd.ticketId);

            const tx = db.transaction(['tickets'], 'readwrite');
            const store = tx.objectStore('tickets');

            store.get(cmd.ticketId).onsuccess = (e) => {
                const ticket = e.target.result;
                if (!ticket) return;

                ticket.status = 'RESOLVED';
                ticket.resolvedAt = Date.now();

                store.put(ticket).onsuccess = () => {
                    console.log('[AGENT] Ticket resolved after approval', ticket.ticketId);
                    setTimeout(() => {
                        loadMyTickets();
                    }, 0);
                };
            };

            break;
        }

        /* =========================
           RESOLUTION REJECTED
        ========================= */
        case 'RESOLUTION_REJECTED': {
            if (cmd.agentId !== myId) break;

            //agent must be online
            if (!currentSession) {
                console.warn('[AGENT] Rejection ignored, agent offline');
                break;
            }

            console.warn('[AGENT] Resolution rejected', cmd.ticketId);

            const tx = db.transaction(['tickets'], 'readwrite');
            const store = tx.objectStore('tickets');

            store.get(cmd.ticketId).onsuccess = (e) => {
                const ticket = e.target.result;
                if (!ticket) return;

                ticket.status = 'IN_PROGRESS';
                ticket.rejectionReason = cmd.reason;
                ticket.rejectedAt = Date.now();

                store.put(ticket).onsuccess = () => {
                    alert(`Resolution rejected by supervisor:\n${cmd.reason}`);
                    loadMyTickets();
                };
            };

            break;
        }

        /* =========================
           DEFAULT
        ========================= */
        default:
            break;
    }
}



//DB

async function saveSession(session) {
    const tx = db.transaction(['agent_sessions'], 'readwrite');
    tx.objectStore('agent_sessions').put(session);
    return new Promise(res => tx.oncomplete = res);
}


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
