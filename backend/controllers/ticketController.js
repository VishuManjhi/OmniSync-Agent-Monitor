import Ticket from '../models/Ticket.js';
import {
    createOrUpsertTicket,
    getAgentTicketsData,
    getAllTicketsData,
    updateTicketData,
    getTicketCollaborators,
    addTicketCollaborator,
    removeTicketCollaborator
} from '../services/ticketService.js';
import { sendTicketReply, getTopHistoricalSolutions, applyHistoricalSolution } from '../services/emailReplyService.js';

/**
 * Create or upsert a ticket
 */
export const createTicket = async (req, res, next) => {
    try {
        const result = await createOrUpsertTicket(req.body);
        res.status(200).json({ ok: true, ticketId: result.ticketId });
    } catch (err) {
        next(err);
    }
};

/**
 * Get tickets for a specific agent (with search and stats)
 */
export const getAgentTickets = async (req, res, next) => {
    try {
        const payload = await getAgentTicketsData({
            agentId: req.params.agentId,
            page: req.query.page,
            limit: req.query.limit,
            search: req.query.search,
            status: req.query.status
        });
        res.json(payload);
    } catch (err) {
        next(err);
    }
};

/**
 * Get all tickets (with advanced filtering and search)
 */
export const getAllTickets = async (req, res, next) => {
    try {
        const payload = await getAllTicketsData({
            page: req.query.page,
            limit: req.query.limit,
            search: req.query.search,
            status: req.query.status
        });

        res.json(payload);
    } catch (err) {
        next(err);
    }
};

/**
 * Update a specific ticket
 */
export const updateTicket = async (req, res, next) => {
    try {
        const result = await updateTicketData(req.params.ticketId, {
            ...(req.body || {}),
            _actorId: req.user?.agentId || req.user?.id || '',
            _actorRole: req.user?.role || ''
        });
        res.json(result);
    } catch (err) {
        if (err.statusCode && err.errorCode) {
            return res.status(err.statusCode).json({ error: err.errorCode, message: err.message });
        }
        if (err.statusCode === 404) {
            return res.status(404).json({ error: 'NOT_FOUND' });
        }
        next(err);
    }
};

export const listCollaborators = async (req, res, next) => {
    try {
        const payload = await getTicketCollaborators(req.params.ticketId);
        res.json(payload);
    } catch (err) {
        next(err);
    }
};

export const addCollaborator = async (req, res, next) => {
    try {
        const payload = await addTicketCollaborator({
            ticketId: req.params.ticketId,
            collaboratorAgentId: req.body.collaboratorAgentId,
            actorId: req.user?.agentId || req.user?.id || 'SYSTEM'
        });
        res.json(payload);
    } catch (err) {
        next(err);
    }
};

export const removeCollaborator = async (req, res, next) => {
    try {
        const payload = await removeTicketCollaborator({
            ticketId: req.params.ticketId,
            collaboratorAgentId: req.body.collaboratorAgentId,
            actorId: req.user?.agentId || req.user?.id || 'SYSTEM'
        });
        res.json(payload);
    } catch (err) {
        next(err);
    }
};

export const sendReply = async (req, res, next) => {
    try {
        const result = await sendTicketReply({
            ticketId: req.params.ticketId,
            templateKey: req.body.templateKey,
            note: req.body.note
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const getTopSolutions = async (req, res, next) => {
    try {
        const result = await getTopHistoricalSolutions({
            ticketId: req.params.ticketId,
            limit: Number(req.query.limit || 3)
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const applyTopSolution = async (req, res, next) => {
    try {
        const result = await applyHistoricalSolution({
            ticketId: req.params.ticketId,
            solutionText: req.body.solution,
            actorId: req.user?.id || req.user?.agentId || 'SYSTEM'
        });
        res.json(result);
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
