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

    const baseQuery = { agentId: { $regex: new RegExp(`^${agentId}$`, 'i') } };
    const query = { ...baseQuery };

    if (status && status !== 'ALL' && status !== 'RAISED') {
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
    const isSupervisorAssigned = existingTicket.assignedBy === 'SUPERVISOR' || (!!existingTicket.createdBy && existingTicket.status !== 'OPEN');

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

    await invalidateTicketCaches(existingTicket.agentId);

    return { ok: true };
}
