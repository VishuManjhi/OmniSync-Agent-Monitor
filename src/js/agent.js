import { openDB } from './db.js';
import { setAgentId, getAgentId } from './utils/sessionStorage.js';
import { initWebSocket, sendMessage } from './comms/websocket.js';
import { initBroadcast, broadcastMessage } from './comms/broadcast.js';
import { startLongPolling } from './comms/longPoll.js';


const DEFAULT_AGENT_ID = null;

let db = null;
let currentSession = null;
let breakInterval = null;
let selectedAttachFile = null;
let attachPreviewURL = null;
let forceLogoutHandled = false;
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
async function forceLogout() {
    if (!currentSession) return;

    currentSession.clockOutTime = new Date().toISOString();

    const tx = db.transaction(['agent_sessions'], 'readwrite');
    tx.objectStore('agent_sessions').put(currentSession);

    currentSession = null;

    updateSessionUI();
    updateButtons();
    updateStatusBadge('offline');

    sendMessage({
        type: 'AGENT_STATUS_CHANGED',
        agentId: getAgentId()
    });

    alert('You were force logged out by supervisor');
}
//inIt
async function initAgentDashboard() {
    let agentId = getAgentId();
    if (!agentId) {
        agentId = window.AGENT_ID;
        setAgentId(agentId);
    }
    agentId = getAgentId();

    document.getElementById('current-agent-id').textContent = agentId;

    initWebSocket(handleWSCommand);
    startLongPolling(handleWSCommand,{
        agentId: getAgentId()
    });

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
function updateTicket(ticketId, updater) {
    const tx = db.transaction(['tickets'], 'readwrite');
    const store = tx.objectStore('tickets');

    store.get(ticketId).onsuccess = (e) => {
        const ticket = e.target.result;
        if (!ticket) return;

        updater(ticket);
        store.put(ticket).onsuccess = () => {
            loadMyTickets();
        };
    };
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
function handleWSMessage(message) {
    if (!message || !message.type) return;

    switch (message.type) {
        case 'FORCE_LOGOUT':
            if (message.agentId === getAgentId()) {
                console.warn('[AGENT] FORCE_LOGOUT received');
                forceLogout();
            }
            break;

        // future commands 
        // case 'PAUSE_AGENT':
        // case 'RESUME_AGENT':

        default:
            // ignore
            break;
    }
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
            if(cursor.value.agentId === agentId){
            tickets.push(cursor.value);
            }
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
            <div class="ticket-card" data-id="${t.ticketId}">
                <strong>${t.issueType}</strong><br>
                Status: <b>${t.status}</b><br>

                ${
                    t.status === 'ASSIGNED'
                        ? `<button class="start-btn">Start Work</button>`
                        : t.status === 'IN_PROGRESS'
                        ? `<button class="resolve-btn">Resolve Ticket</button>`
                        : ''
                }
            </div>
        `).join('')
        : '<p>No assigned tickets.</p>';
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

    const agentId = currentSession.agentId; //  snapshot

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
function handleWSCommand(cmd) {
    if (!cmd || !cmd.type) return;

    const myId = getAgentId();

    switch (cmd.type) {
        // force Logout 
        
        case 'FORCE_LOGOUT': {
            if (cmd.agentId !== myId) return;

            // prevent repeat execution
            if (forceLogoutHandled) {
                console.log('[AGENT] FORCE_LOGOUT already handled, ignoring');
                return;
            }

            forceLogoutHandled = true;

            console.warn('[AGENT] Forced logout by supervisor');

            if (currentSession) {
                currentSession.clockOutTime = new Date().toISOString();
                saveSession(currentSession);
                currentSession = null;
            }

            updateSessionUI();
            updateButtons();
            updateStatusBadge('offline');

            sendMessage({
                type: 'AGENT_STATUS_CHANGED',
                agentId: myId,
                status: 'offline'
            });

            alert('You have been logged out by supervisor');
            break;
        }
        case 'ASSIGN_TICKET': {
        if (cmd.agentId !== myId) return;

        console.warn('[AGENT] Ticket assigned by supervisor', cmd.payload);

        const ticket = {
        ...cmd.payload,
        agentId: myId,          
        status: 'ASSIGNED'      
        };

        const tx = db.transaction(['tickets'], 'readwrite');
        const store = tx.objectStore('tickets');

        store.put(ticket).onsuccess = () => {
        console.log('[AGENT] Assigned ticket saved', ticket.ticketId);
        loadMyTickets();
        };

        break;
    }

        // resolution Approved
        
        case 'RESOLUTION_APPROVED': {
            if (cmd.agentId !== myId) return;

            console.warn('[AGENT] Resolution approved for ticket', cmd.ticketId);

            const tx = db.transaction(['tickets'], 'readwrite');
            const store = tx.objectStore('tickets');

            store.get(cmd.ticketId).onsuccess = (e) => {
                const ticket = e.target.result;
                if (!ticket) return;

                // safety check
                if (ticket.status !== 'RESOLUTION_REQUESTED') {
                    console.warn('[AGENT] Ticket not in resolvable state');
                    return;
                }

                ticket.status = 'RESOLVED';
                ticket.resolvedAt = Date.now();

                store.put(ticket).onsuccess = () => {
                    alert(`Ticket ${cmd.ticketId} resolved`);
                    loadMyTickets();
                };
            };
            break;
        }
        // Future commands 
        default:
            // ignore unknown commands
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
        const btn = e.target;
        const card = btn.closest('.ticket-card');
        if (!card) return;

        const ticketId = card.dataset.id;
        console.log('[AGENT] Ticket click:', ticketId, btn.className);

        if (btn.classList.contains('start-btn')) {
            updateTicket(ticketId, (ticket) => {
                if (ticket.status !== 'ASSIGNED') return;

                ticket.status = 'IN_PROGRESS';
                ticket.startedAt = Date.now();
            });
        }

        if (btn.classList.contains('resolve-btn')) {
            updateTicket(ticketId, (ticket) => {
                if (ticket.status !== 'IN_PROGRESS') return;

                ticket.status = 'RESOLVED';
                ticket.resolvedAt = Date.now();

                if (ticket.startedAt) {
                    ticket.workDuration =
                        ticket.resolvedAt - ticket.startedAt;
               }
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
