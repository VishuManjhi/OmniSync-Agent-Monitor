import crypto from 'crypto';
import { connectDb } from './db.js';
import Agent from './models/Agent.js';
import Ticket from './models/Ticket.js';
import Session from './models/Session.js';

const AGENT_COUNT = Number(process.env.SEED_AGENT_COUNT || 20);
const TICKET_COUNT = Number(process.env.SEED_TICKET_COUNT || 300);
const ACTIVE_SESSIONS = Number(process.env.SEED_ACTIVE_SESSIONS || 8);
const RESET_EXISTING = String(process.env.SEED_RESET || 'false').toLowerCase() === 'true';

const ISSUE_TYPES = ['FOH', 'BOH', 'KIOSK', 'other'];
const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLUTION_REQUESTED', 'RESOLVED', 'REJECTED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const RUN_TAG = Date.now().toString().slice(-6);

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sample = (arr) => arr[randomInt(0, arr.length - 1)];

function createAgentDoc(index) {
    const agentId = `a${index + 1}`;
    return {
        agentId,
        name: `Agent ${index + 1}`,
        email: `${agentId}@vba.local`,
        role: 'agent',
        password: 'agent123'
    };
}

function createSupervisorDocs() {
    return [
        { agentId: 'admin', name: 'Aryan', email: 'admin@vba.local', role: 'supervisor', password: 'sup123' },
        { agentId: 'sup1', name: 'Vishu', email: 'sup1@vba.local', role: 'supervisor', password: 'sup123' }
    ];
}

function buildTicket(agentId, index) {
    const now = Date.now();
    const ageHours = randomInt(1, 240);
    const issueDateTime = now - ageHours * 60 * 60 * 1000;
    const status = sample(STATUSES);
    const startedAt = status === 'OPEN' ? undefined : issueDateTime + randomInt(5, 120) * 60 * 1000;

    let resolvedAt;
    if (status === 'RESOLVED' || status === 'REJECTED') {
        resolvedAt = (startedAt || issueDateTime) + randomInt(10, 360) * 60 * 1000;
    }

    return {
        ticketId: crypto.randomUUID(),
        displayId: `TKT-${agentId.toUpperCase()}-${RUN_TAG}-${String(index + 1).padStart(4, '0')}`,
        agentId,
        issueType: sample(ISSUE_TYPES),
        description: `Seeded test ticket ${index + 1} for ${agentId}`,
        status,
        issueDateTime,
        callDuration: randomInt(30, 1200),
        priority: sample(PRIORITIES),
        assignedBy: Math.random() > 0.7 ? 'SUPERVISOR' : 'SYSTEM',
        createdBy: Math.random() > 0.65 ? sample(['admin', 'sup1']) : undefined,
        startedAt,
        resolvedAt,
        resolutionRequestedAt: status === 'RESOLUTION_REQUESTED' ? now - randomInt(1, 48) * 60 * 60 * 1000 : undefined,
        attachments: []
    };
}

function buildSession(agentId, isActive) {
    const now = Date.now();
    const start = now - randomInt(1, 12) * 60 * 60 * 1000;
    const onBreak = Math.random() > 0.8;

    return {
        sessionID: crypto.randomUUID(),
        agentId,
        clockInTime: start,
        clockOutTime: isActive ? null : start + randomInt(1, 8) * 60 * 60 * 1000,
        onCall: Math.random() > 0.5,
        onBreak,
        breaks: onBreak ? [{ breakIn: now - randomInt(5, 45) * 60 * 1000, breakOut: null }] : [],
        lastActivity: now - randomInt(0, 30) * 60 * 1000
    };
}

async function seedBulk() {
    await connectDb();

    if (RESET_EXISTING) {
        await Promise.all([
            Agent.deleteMany({}),
            Ticket.deleteMany({}),
            Session.deleteMany({})
        ]);
    }

    const agentDocs = Array.from({ length: AGENT_COUNT }, (_, i) => createAgentDoc(i));
    const supervisorDocs = createSupervisorDocs();

    const users = [...agentDocs, ...supervisorDocs];
    await Promise.all(users.map((user) => Agent.updateOne(
        { agentId: user.agentId },
        { $setOnInsert: user },
        { upsert: true }
    )));

    const allAgentIds = agentDocs.map(a => a.agentId);
    const tickets = Array.from({ length: TICKET_COUNT }, (_, i) => buildTicket(sample(allAgentIds), i));
    await Ticket.insertMany(tickets, { ordered: false });

    const activeSet = new Set(allAgentIds.slice(0, Math.min(ACTIVE_SESSIONS, allAgentIds.length)));
    const sessions = allAgentIds.map(aid => buildSession(aid, activeSet.has(aid)));
    await Session.insertMany(sessions, { ordered: false });

    const counts = await Promise.all([
        Agent.countDocuments(),
        Ticket.countDocuments(),
        Session.countDocuments()
    ]);

    console.log('[SEED_BULK] Completed');
    console.log(`[SEED_BULK] agents=${counts[0]} tickets=${counts[1]} sessions=${counts[2]}`);
    console.log('[SEED_BULK] mode:', RESET_EXISTING ? 'reset' : 'append');
    console.log('[SEED_BULK] logins: admin/sup123 and a1..aN/agent123');
}

seedBulk()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[SEED_BULK] Failed:', err);
        process.exit(1);
    });
