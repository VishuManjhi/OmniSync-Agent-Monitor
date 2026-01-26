import { openDB } from './db.js';
import { setAgentId, getAgentId } from './utils/sessionStorage.js';
import { initWebSocket, sendMessage } from './comms/websocket.js';
import { initBroadcast, broadcastMessage } from './comms/broadcast.js';


const DEFAULT_AGENT_ID = 'a1';

let db = null;
let currentSession = null;
let breakInterval = null;
let selectedAttachFile = null;
let attachPreviewURL = null;
attachPreviewURL && URL.revokeObjectURL(attachPreviewURL);
attachPreviewURL = null;


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
//inIt
async function initAgentDashboard() {
    let agentId = getAgentId();
    if (!agentId) {
        agentId = DEFAULT_AGENT_ID;
        setAgentId(agentId);
    }

    document.getElementById('current-agent-id').textContent = agentId;

    initWebSocket();

    db = await openDB();
    await loadCurrentSession(agentId);
    loadMyTickets();
    setupEventHandlers();
    setupAttachmentPreview();
    initBroadcast((msg) => {});

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
    if (!currentSession) {
        document.getElementById('clock-in-time').textContent = '--:--:--';
        document.getElementById('session-status').textContent = 'Not Clocked In';
        document.getElementById('break-duration').textContent = '00:00:00';
        return;
    }

    document.getElementById('clock-in-time').textContent =
    currentSession.clockInTime
        ? new Date(currentSession.clockInTime).toLocaleTimeString()
        : '--:--:--';

    const status = deriveSessionStatus(currentSession);

     document.getElementById('session-status').textContent =
     status.replace('-', ' ').toUpperCase();

}

function updateButtons() {
    const active = !!currentSession;
    const status = deriveSessionStatus(currentSession);
    const onBreak = status === 'on-break'   

    document.getElementById('clock-in-btn').disabled = active;
    document.getElementById('clock-out-btn').disabled = !active;
    document.getElementById('clock-out-btn').disabled = !active || onBreak;
    document.getElementById('break-in-btn').disabled = !active || onBreak;
    document.getElementById('break-out-btn').disabled = !onBreak;

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

        const start = new Date(lastBreak.breakIn).getTime();
        const now = Date.now();
        const diff = now - start;

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        document.getElementById('break-duration').textContent =
            `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
}
//sessionLoad

async function loadCurrentSession(agentId) {
    currentSession = null;

    const tx = db.transaction(['agent_sessions'], 'readonly');
    const store = tx.objectStore('agent_sessions');
    const index = store.index('agentId');

    const sessions = [];

    index.openCursor(IDBKeyRange.only(agentId)).onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            const s = cursor.value;
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
        status: form.get('status'),
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
    console.log('Ticket + attachment transaction committed');};
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
            tickets.push(cursor.value);
            cursor.continue();
        } else {
            renderMyTickets(tickets);
        }
    };
}

function renderMyTickets(tickets) {
    const container = document.getElementById('my-tickets');
    if (!container) return;

    container.innerHTML = tickets.length
        ? tickets.map(t => `
            <div class="ticket-card">
                <strong>${t.issueType}</strong><br>
                Status: <b>${t.status}</b><br>
                <button 
                    data-id="${t.ticketId}"
                    ${t.status === 'resolved' ? 'disabled' : ''}>
                    Mark Resolved
                </button>
            </div>
        `).join('')
        : '<p>No tickets raised.</p>';
}


//clocks

async function handleClockIn() {
    const agentId = getAgentId();
    if (!agentId) return;

    if (currentSession) return;

    currentSession = {
        sessionID: crypto.randomUUID(),
        agentId,
        clockInTime: new Date().toISOString(),
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

    const agentId = currentSession.agentId; // ✅ snapshot

    currentSession.clockOutTime = new Date().toISOString();

    const tx = db.transaction(['agent_sessions'], 'readwrite');
    const store = tx.objectStore('agent_sessions');

    store.put(currentSession).onsuccess = () => {
        currentSession = null;

        updateSessionUI();
        updateButtons();
        updateStatusBadge('offline');

        sendMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId
        });

        broadcastMessage({
            type: 'AGENT_STATUS_CHANGED',
            agentId
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
        breakIn: new Date().toISOString(),
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

    lastBreak.breakOut = new Date().toISOString();

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
    document.getElementById('go-supervisor-btn')
        ?.addEventListener('click', () => {
    window.location.href = 'index.html';
    });


    const ticketForm = document.getElementById('ticket-form');
    if (!ticketForm) {
        console.error(' ticket-form not found');
        return;
    }

    ticketForm.addEventListener('submit', handleTicketSubmit);
    
}

//boot

document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initAgentDashboard)
    : initAgentDashboard();

