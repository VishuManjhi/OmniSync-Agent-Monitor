import Ticket from '../models/Ticket.js';
import Agent from '../models/Agent.js';
import mongoose from 'mongoose';
import { saveFileFromBase64 } from '../services/fileStorage.js';

/**
 * Create or upsert a ticket
 */
export const createTicket = async (req, res, next) => {
    try {
        const ticketData = req.body;

        // Process attachments: Move from Base64 to Disk
        if (ticketData.attachments && Array.isArray(ticketData.attachments)) {
            for (let attachment of ticketData.attachments) {
                if (attachment.content && !attachment.path) {
                    const filePath = await saveFileFromBase64(attachment.content, attachment.fileName);
                    attachment.path = filePath;
                    attachment.content = undefined; // Clear the heavy Base64 content
                }
            }
        }

        await Ticket.updateOne(
            { ticketId: ticketData.ticketId },
            { $set: ticketData },
            { upsert: true }
        );

        res.status(200).json({ ok: true });
    } catch (err) {
        next(err);
    }
};

/**
 * Get tickets for a specific agent (with search and stats)
 */
export const getAgentTickets = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { search = '', status = 'ALL' } = req.query;

        // Exact match for agentId (case-insensitive)
        const baseQuery = { agentId: { $regex: new RegExp(`^${agentId}$`, 'i') } };
        let query = { ...baseQuery };

        if (status && status !== 'ALL' && status !== 'RAISED') {
            query.status = status;
        } else if (status === 'RAISED') {
            // Specific for raised view if needed, but baseQuery covers all raised by agent
            // No extra condition
        }

        if (search && search.trim()) {
            const searchStr = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(searchStr, 'i');
            query.$or = [
                { ticketId: searchRegex },
                { displayId: searchRegex },
                { description: searchRegex }
            ];
        }

        const [total, tickets, resolvedTickets] = await Promise.all([
            Ticket.countDocuments(query),
            Ticket.find(query).sort({ issueDateTime: -1 }).skip(skip).limit(limit),
            Ticket.find({ ...baseQuery, status: 'RESOLVED' })
        ]);

        const totalResolved = resolvedTickets.length;
        const totalHandleTime = resolvedTickets.reduce((acc, t) => {
            if (t.startedAt && t.resolvedAt && t.startedAt > 0) {
                return acc + (t.resolvedAt - t.startedAt);
            }
            return acc;
        }, 0);
        const avgHandleTime = totalResolved > 0 ? Math.floor(totalHandleTime / totalResolved / 1000) : 0;

        res.json({
            tickets: tickets || [],
            total: total || 0,
            pages: Math.ceil((total || 0) / limit),
            currentPage: page,
            stats: {
                totalResolved,
                avgHandleTime
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get all tickets (with advanced filtering and search)
 */
export const getAllTickets = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const { search = '', status = 'ALL' } = req.query;

        let query = {};
        if (search && search.trim()) {
            const searchStr = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(searchStr, 'i');

            const matchingAgents = await Agent.find({
                $or: [
                    { agentId: searchRegex },
                    { name: searchRegex }
                ]
            }).select('agentId');
            const matchingAgentIds = matchingAgents.map(a => a.agentId);

            query.$or = [
                { ticketId: searchRegex },
                { displayId: searchRegex },
                { description: searchRegex },
                { agentId: { $in: matchingAgentIds } }
            ];
        }

        // Apply status filter
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
            .limit(limit);

        res.json({
            tickets,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Update a specific ticket
 */
export const updateTicket = async (req, res, next) => {
    try {
        const { ticketId } = req.params;
        const updates = req.body || {};

        const query = mongoose.Types.ObjectId.isValid(ticketId)
            ? { $or: [{ _id: ticketId }, { ticketId: ticketId }] }
            : { ticketId };

        const existingTicket = await Ticket.findOne(query).lean();
        if (!existingTicket) {
            return res.status(404).json({ error: 'NOT_FOUND' });
        }

        const nextStatus = updates.status;
        const currentStatus = existingTicket.status;
        const isSupervisorAssigned = existingTicket.assignedBy === 'SUPERVISOR' || (!!existingTicket.createdBy && existingTicket.status !== 'OPEN');

        if (nextStatus && isSupervisorAssigned) {
            if (currentStatus === 'ASSIGNED' && nextStatus !== 'IN_PROGRESS') {
                return res.status(400).json({ error: 'INVALID_STATUS_TRANSITION', message: 'Assigned supervisor ticket must be accepted first' });
            }

            if (currentStatus === 'IN_PROGRESS' && nextStatus !== 'RESOLUTION_REQUESTED') {
                return res.status(400).json({ error: 'INVALID_STATUS_TRANSITION', message: 'Supervisor ticket in progress must request resolution first' });
            }

            if (currentStatus === 'RESOLUTION_REQUESTED' && !['RESOLVED', 'IN_PROGRESS'].includes(nextStatus)) {
                return res.status(400).json({ error: 'INVALID_STATUS_TRANSITION', message: 'Awaiting-resolution ticket can only be approved or sent back to in-progress' });
            }

            if (['RESOLVED', 'REJECTED'].includes(currentStatus)) {
                return res.status(400).json({ error: 'INVALID_STATUS_TRANSITION', message: 'Finalized ticket cannot transition' });
            }
        }

        if (nextStatus === 'RESOLUTION_REQUESTED' && !updates.resolutionRequestedAt) {
            updates.resolutionRequestedAt = Date.now();
        }

        // Automatically append resolvedAt timestamp if status is being updated directly to RESOLVED
        if (updates.status === 'RESOLVED' && !updates.resolvedAt) {
            updates.resolvedAt = Date.now();
        }

        const result = await Ticket.updateOne(query, { $set: updates });

        if (!result.matchedCount) {
            return res.status(404).json({ error: 'NOT_FOUND' });
        }

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};

/**
 * Get supervisor activity (tickets created by them)
 */
export const getSupervisorActivity = async (req, res, next) => {
    try {
        const { supervisorId } = req.params;
        const activity = await Ticket.find({ createdBy: supervisorId }).sort({ createdAt: -1 });
        res.json(activity);
    } catch (err) {
        next(err);
    }
};
