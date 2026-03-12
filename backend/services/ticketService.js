import crypto from 'crypto';
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import Agent from '../models/Agent.js';
import { saveFileFromBase64 } from './fileStorage.js';
import { invalidatePattern } from './cacheService.js';

async function processAttachments(attachments) {
    if (!attachments || !Array.isArray(attachments)) return attachments;

    for (const attachment of attachments) {
        if (attachment.content && !attachment.path) {
            const filePath = await saveFileFromBase64(attachment.content, attachment.fileName);
            attachment.path = filePath;
            attachment.content = undefined;
        }
    }

    return attachments;
}

export async function invalidateTicketCaches(agentId) {
    try {
        if (agentId) {
            await invalidatePattern(`agent:report:${agentId}:*`);
        }
        await invalidatePattern('sla:*');
        await invalidatePattern('queue:*');
    } catch (err) {
        console.warn('[CACHE] Ticket cache invalidation failed', err);
    }
}

export async function createOrUpsertTicket(ticketDataInput) {
    const ticketData = { ...(ticketDataInput || {}) };

    if (!ticketData.ticketId) {
        ticketData.ticketId = crypto.randomUUID();
    }

    if (!ticketData.issueDateTime) {
        ticketData.issueDateTime = Date.now();
    }

    if (!ticketData.displayId) {
        ticketData.displayId = `TKT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    }

    if (!ticketData.collaboration) {
        const primaryAgentId = ticketData.agentId && ticketData.agentId !== 'UNASSIGNED'
            ? ticketData.agentId
            : null;

        ticketData.collaboration = {
            roomId: `ticket:${ticketData.ticketId}`,
            primaryAgentId,
            collaborators: primaryAgentId
                ? [{ agentId: primaryAgentId, role: 'primary', joinedAt: Date.now(), invitedBy: 'SYSTEM', active: true }]
                : [],
            lastActivityAt: Date.now()
        };
    }

    ticketData.attachments = await processAttachments(ticketData.attachments);

    await Ticket.updateOne(
        { ticketId: ticketData.ticketId },
        { $set: ticketData },
        { upsert: true }
    );

    await invalidateTicketCaches(ticketData.agentId);

    return { ok: true, ticketId: ticketData.ticketId };
}

export async function getAgentTicketsData({ agentId, page = 1, limit = 10, search = '', status = 'ALL' }) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const baseQuery = {
        agentId: { $regex: new RegExp(`^${agentId}$`, 'i') }
    };
    const query = { ...baseQuery };

    if (status === 'ARCHIVE') {
        query.status = { $in: ['RESOLVED', 'REJECTED', 'PENDING_CUSTOMER'] };
    } else if (status === 'ACTIVE') {
        query.status = { $nin: ['RESOLVED', 'REJECTED'] };
    } else if (status && status !== 'ALL' && status !== 'RAISED') {
        query.status = status;
    }

    if (search && String(search).trim()) {
        const searchStr = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(searchStr, 'i');
        query.$or = [
            { ticketId: searchRegex },
            { displayId: searchRegex },
            { description: searchRegex }
        ];
    }

    const [total, tickets, resolvedTickets] = await Promise.all([
        Ticket.countDocuments(query),
        Ticket.find(query).sort({ issueDateTime: -1 }).skip(skip).limit(safeLimit),
        Ticket.find({ ...baseQuery, status: 'RESOLVED' })
    ]);

    const totalResolved = resolvedTickets.length;
    const totalHandleTime = resolvedTickets.reduce((acc, t) => {
        if (t.startedAt && t.resolvedAt && t.startedAt > 0) {
            return acc + (t.resolvedAt - t.startedAt);
        }
        return acc;
    }, 0);

    return {
        tickets: tickets || [],
        total: total || 0,
        pages: Math.ceil((total || 0) / safeLimit),
        currentPage: safePage,
        stats: {
            totalResolved,
            avgHandleTime: totalResolved > 0 ? Math.floor(totalHandleTime / totalResolved / 1000) : 0
        }
    };
}

export async function getAllTicketsData({ page = 1, limit = 10, search = '', status = 'ALL' }) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const query = {};

    if (search && String(search).trim()) {
        const searchStr = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(searchStr, 'i');

        const matchingAgents = await Agent.find({
            $or: [{ agentId: searchRegex }, { name: searchRegex }]
        }).select('agentId');
        const matchingAgentIds = matchingAgents.map(a => a.agentId);

        query.$or = [
            { ticketId: searchRegex },
            { displayId: searchRegex },
            { description: searchRegex },
            { agentId: { $in: matchingAgentIds } }
        ];
    }

    if (status === 'ACTIVE') {
        query.status = { $nin: ['RESOLVED', 'REJECTED'] };
    } else if (status === 'RESOLVED') {
        query.status = { $in: ['RESOLVED', 'REJECTED'] };
    } else if (status === 'PRIORITY') {
        const oneDayAgo = Date.now() - 86400000;
        query.status = { $nin: ['RESOLVED', 'REJECTED'] };
        query.issueDateTime = { $lt: oneDayAgo };
    }

    const total = await Ticket.countDocuments(query);
    const tickets = await Ticket.find(query)
        .sort({ issueDateTime: -1 })
        .skip(skip)
        .limit(safeLimit);

    return {
        tickets,
        total,
        pages: Math.ceil(total / safeLimit),
        currentPage: safePage
    };
}

export async function updateTicketData(ticketId, updatesInput) {
    const updates = updatesInput || {};
    const actorId = String(updates._actorId || '').trim().toLowerCase();
    const actorRole = String(updates._actorRole || '').trim().toLowerCase();

    delete updates._actorId;
    delete updates._actorRole;

    const query = mongoose.Types.ObjectId.isValid(ticketId)
        ? { $or: [{ _id: ticketId }, { ticketId }] }
        : { ticketId };

    const existingTicket = await Ticket.findOne(query).lean();
    if (!existingTicket) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    const nextStatus = updates.status;
    const currentStatus = existingTicket.status;
    const isSupervisorAssigned = existingTicket.assignedBy === 'SUPERVISOR';
    const primaryAgentId = String(existingTicket?.collaboration?.primaryAgentId || existingTicket.agentId || '').trim().toLowerCase();

    if (nextStatus && actorRole === 'agent' && primaryAgentId && actorId && actorId !== primaryAgentId) {
        const err = new Error('Only the primary assignee can change ticket status');
        err.statusCode = 403;
        err.errorCode = 'COLLAB_PRIMARY_REQUIRED';
        throw err;
    }

    if (nextStatus && isSupervisorAssigned) {
        if (currentStatus === 'ASSIGNED' && nextStatus !== 'IN_PROGRESS') {
            const err = new Error('Assigned supervisor ticket must be accepted first');
            err.statusCode = 400;
            err.errorCode = 'INVALID_STATUS_TRANSITION';
            throw err;
        }

        if (currentStatus === 'IN_PROGRESS' && nextStatus !== 'RESOLUTION_REQUESTED') {
            const err = new Error('Supervisor ticket in progress must request resolution first');
            err.statusCode = 400;
            err.errorCode = 'INVALID_STATUS_TRANSITION';
            throw err;
        }

        if (currentStatus === 'RESOLUTION_REQUESTED' && !['RESOLVED', 'IN_PROGRESS'].includes(nextStatus)) {
            const err = new Error('Awaiting-resolution ticket can only be approved or sent back to in-progress');
            err.statusCode = 400;
            err.errorCode = 'INVALID_STATUS_TRANSITION';
            throw err;
        }

        if (['RESOLVED', 'REJECTED'].includes(currentStatus)) {
            const err = new Error('Finalized ticket cannot transition');
            err.statusCode = 400;
            err.errorCode = 'INVALID_STATUS_TRANSITION';
            throw err;
        }
    }

    if (nextStatus === 'RESOLUTION_REQUESTED' && !updates.resolutionRequestedAt) {
        updates.resolutionRequestedAt = Date.now();
    }

    if (updates.status === 'RESOLVED' && !updates.resolvedAt) {
        updates.resolvedAt = Date.now();
    }

    const result = await Ticket.updateOne(query, { $set: updates });
    if (!result.matchedCount) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    if (nextStatus && nextStatus !== currentStatus) {
        const movedToFinal = ['RESOLVED', 'REJECTED'].includes(nextStatus) && !['RESOLVED', 'REJECTED'].includes(currentStatus);
        const reopenedFromFinal = !['RESOLVED', 'REJECTED'].includes(nextStatus) && ['RESOLVED', 'REJECTED'].includes(currentStatus);

        if (movedToFinal) {
            await Agent.updateOne(
                { agentId: existingTicket.agentId, activeOpenTickets: { $gt: 0 } },
                { $inc: { activeOpenTickets: -1 } }
            );
        }

        if (reopenedFromFinal) {
            await Agent.updateOne(
                { agentId: existingTicket.agentId },
                { $inc: { activeOpenTickets: 1 } }
            );
        }
    }

    await invalidateTicketCaches(existingTicket.agentId);

    return { ok: true };
}

export async function getTicketCollaborators(ticketId) {
    const query = mongoose.Types.ObjectId.isValid(ticketId)
        ? { $or: [{ _id: ticketId }, { ticketId }] }
        : { ticketId };

    const ticket = await Ticket.findOne(query).lean();
    if (!ticket) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    return {
        ok: true,
        ticketId: ticket.ticketId,
        roomId: ticket?.collaboration?.roomId || `ticket:${ticket.ticketId}`,
        primaryAgentId: ticket?.collaboration?.primaryAgentId || ticket.agentId,
        collaborators: ticket?.collaboration?.collaborators || []
    };
}

export async function addTicketCollaborator({ ticketId, collaboratorAgentId, actorId }) {
    const normalizedCollaborator = String(collaboratorAgentId || '').trim().toLowerCase();
    if (!normalizedCollaborator) {
        const err = new Error('COLLABORATOR_REQUIRED');
        err.statusCode = 400;
        throw err;
    }

    const query = mongoose.Types.ObjectId.isValid(ticketId)
        ? { $or: [{ _id: ticketId }, { ticketId }] }
        : { ticketId };

    const ticket = await Ticket.findOne(query).lean();
    if (!ticket) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    const primaryAgentId = String(ticket?.collaboration?.primaryAgentId || ticket.agentId || '').trim().toLowerCase();
    const normalizedActor = String(actorId || '').trim().toLowerCase();
    if (primaryAgentId && normalizedActor && normalizedActor !== primaryAgentId) {
        const err = new Error('Only primary assignee can add collaborators');
        err.statusCode = 403;
        err.errorCode = 'COLLAB_PRIMARY_REQUIRED';
        throw err;
    }

    if (normalizedCollaborator === primaryAgentId) {
        return getTicketCollaborators(ticket.ticketId);
    }

    const currentCollaborators = Array.isArray(ticket?.collaboration?.collaborators)
        ? ticket.collaboration.collaborators
        : [];

    const existing = currentCollaborators.find((item) => String(item.agentId || '').trim().toLowerCase() === normalizedCollaborator);
    const updateDoc = {
        $set: {
            'collaboration.roomId': ticket?.collaboration?.roomId || `ticket:${ticket.ticketId}`,
            'collaboration.primaryAgentId': primaryAgentId || null,
            'collaboration.lastActivityAt': Date.now()
        }
    };

    if (existing) {
        await Ticket.updateOne(
            {
                ticketId: ticket.ticketId,
                'collaboration.collaborators.agentId': existing.agentId
            },
            {
                $set: {
                    'collaboration.collaborators.$.active': true,
                    'collaboration.collaborators.$.role': existing.role === 'primary' ? 'primary' : 'secondary',
                    'collaboration.lastActivityAt': Date.now()
                }
            }
        );
    } else {
        updateDoc.$push = {
            'collaboration.collaborators': {
                agentId: normalizedCollaborator,
                role: 'secondary',
                joinedAt: Date.now(),
                invitedBy: normalizedActor || 'SYSTEM',
                active: true
            }
        };
        await Ticket.updateOne({ ticketId: ticket.ticketId }, updateDoc);
    }

    await invalidateTicketCaches(ticket.agentId);
    return getTicketCollaborators(ticket.ticketId);
}

export async function removeTicketCollaborator({ ticketId, collaboratorAgentId, actorId }) {
    const normalizedCollaborator = String(collaboratorAgentId || '').trim().toLowerCase();
    if (!normalizedCollaborator) {
        const err = new Error('COLLABORATOR_REQUIRED');
        err.statusCode = 400;
        throw err;
    }

    const query = mongoose.Types.ObjectId.isValid(ticketId)
        ? { $or: [{ _id: ticketId }, { ticketId }] }
        : { ticketId };

    const ticket = await Ticket.findOne(query).lean();
    if (!ticket) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    const primaryAgentId = String(ticket?.collaboration?.primaryAgentId || ticket.agentId || '').trim().toLowerCase();
    const normalizedActor = String(actorId || '').trim().toLowerCase();

    if (primaryAgentId && normalizedActor && normalizedActor !== primaryAgentId) {
        const err = new Error('Only primary assignee can remove collaborators');
        err.statusCode = 403;
        err.errorCode = 'COLLAB_PRIMARY_REQUIRED';
        throw err;
    }

    if (normalizedCollaborator === primaryAgentId) {
        const err = new Error('Primary assignee cannot be removed');
        err.statusCode = 400;
        err.errorCode = 'PRIMARY_CANNOT_BE_REMOVED';
        throw err;
    }

    await Ticket.updateOne(
        {
            ticketId: ticket.ticketId,
            'collaboration.collaborators.agentId': normalizedCollaborator
        },
        {
            $set: {
                'collaboration.collaborators.$.active': false,
                'collaboration.lastActivityAt': Date.now()
            }
        }
    );

    await invalidateTicketCaches(ticket.agentId);
    return getTicketCollaborators(ticket.ticketId);
}

export async function setTicketPendingCustomer(ticketId, meta = {}) {
    const query = mongoose.Types.ObjectId.isValid(ticketId)
        ? { $or: [{ _id: ticketId }, { ticketId }] }
        : { ticketId };

    const ticket = await Ticket.findOne(query).lean();
    if (!ticket) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    const updateDoc = {
        $set: {
            status: 'PENDING_CUSTOMER',
            'emailMeta.lastOutboundAt': Date.now()
        }
    };

    if (meta.reply) {
        updateDoc.$push = { 'emailMeta.replies': meta.reply };
    }

    await Ticket.updateOne(query, updateDoc);
    await invalidateTicketCaches(ticket.agentId);

    return ticket;
}
