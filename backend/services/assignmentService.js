import mongoose from 'mongoose';
import Agent from '../models/Agent.js';
import Ticket from '../models/Ticket.js';

const COOLDOWN_MS = Number(process.env.EMAIL_ASSIGN_COOLDOWN_MS || 120000);
const OPEN_TICKET_PENALTY = Number(process.env.EMAIL_ASSIGN_OPEN_TICKET_PENALTY || 15);
const COOLDOWN_PENALTY = Number(process.env.EMAIL_ASSIGN_COOLDOWN_PENALTY || 25);

function computeScore(agent, now) {
    const weightScore = Math.max(Number(agent.assignmentWeight || 1), 0) * 100;
    const openPenalty = Math.max(Number(agent.activeOpenTickets || 0), 0) * OPEN_TICKET_PENALTY;
    const cooldownPenalty = agent.lastAssignedAt && (now - Number(agent.lastAssignedAt) < COOLDOWN_MS)
        ? COOLDOWN_PENALTY
        : 0;

    return weightScore - openPenalty - cooldownPenalty;
}

function selectBestAgent(agents) {
    const now = Date.now();
    const scored = agents
        .map((agent) => ({
            agent,
            score: computeScore(agent, now),
            tieBreaker: Number(agent.lastAssignedAt || 0)
        }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.tieBreaker - b.tieBreaker;
        });

    return scored[0]?.agent || null;
}

async function runAssignment(ticketId, session) {
    const ticket = await Ticket.findOne({ ticketId }).session(session);
    if (!ticket) {
        const err = new Error('TICKET_NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    const agents = await Agent.find({
        role: 'agent',
        assignmentEnabled: true,
        $or: [
            { assignmentSkills: { $size: 0 } },
            { assignmentSkills: ticket.issueType }
        ]
    }).session(session);

    if (!agents.length) {
        const err = new Error('NO_ELIGIBLE_AGENTS');
        err.statusCode = 409;
        throw err;
    }

    const selectedAgent = selectBestAgent(agents);
    if (!selectedAgent) {
        const err = new Error('NO_ELIGIBLE_AGENTS');
        err.statusCode = 409;
        throw err;
    }

    const now = Date.now();

    await Ticket.updateOne(
        { ticketId },
        {
            $set: {
                agentId: selectedAgent.agentId,
                assignedBy: 'SYSTEM',
                status: 'ASSIGNED',
                'emailMeta.assignedAt': now,
                'emailMeta.assignedAgentId': selectedAgent.agentId,
                'collaboration.roomId': `ticket:${ticketId}`,
                'collaboration.primaryAgentId': selectedAgent.agentId,
                'collaboration.lastActivityAt': now
            }
        },
        { session }
    );

    await Ticket.updateOne(
        {
            ticketId,
            'collaboration.collaborators.agentId': { $ne: selectedAgent.agentId }
        },
        {
            $push: {
                'collaboration.collaborators': {
                    agentId: selectedAgent.agentId,
                    role: 'primary',
                    joinedAt: now,
                    invitedBy: 'SYSTEM',
                    active: true
                }
            }
        },
        { session }
    );

    await Agent.updateOne(
        { _id: selectedAgent._id },
        {
            $set: { lastAssignedAt: now },
            $inc: { activeOpenTickets: 1 }
        },
        { session }
    );

    return { agentId: selectedAgent.agentId };
}

export async function assignTicket(ticketId) {
    const session = await mongoose.startSession();

    try {
        let assignmentResult = null;

        await session.withTransaction(async () => {
            assignmentResult = await runAssignment(ticketId, session);
        });

        return assignmentResult;
    } catch (err) {
        if (String(err.message || '').includes('Transaction numbers are only allowed on a replica set member or mongos')) {
            const fallback = await runAssignment(ticketId, null);
            return fallback;
        }
        throw err;
    } finally {
        await session.endSession();
    }
}
