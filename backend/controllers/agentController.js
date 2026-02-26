import Agent from '../models/Agent.js';
import Session from '../models/Session.js';

/**
 * Get all agents
 */
export const getAllAgents = async (req, res, next) => {
    try {
        const agents = await Agent.find({});
        res.json(agents);
    } catch (err) {
        next(err);
    }
};

/**
 * Get agent by ID
 */
export const getAgentById = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const agent = await Agent.findOne({ agentId });
        if (!agent) return res.status(404).json({ error: 'NOT_FOUND' });
        res.json(agent);
    } catch (err) {
        next(err);
    }
};

/**
 * Update agent email
 */
export const updateAgentEmail = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const { email } = req.body || {};

        if (typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ error: 'INVALID_EMAIL' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(normalizedEmail)) {
            return res.status(400).json({ error: 'INVALID_EMAIL_FORMAT' });
        }

        const updated = await Agent.findOneAndUpdate(
            { agentId },
            { $set: { email: normalizedEmail } },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'NOT_FOUND' });
        }

        res.json({ ok: true, agentId: updated.agentId, email: updated.email });
    } catch (err) {
        next(err);
    }
};

/**
 * Save or update agent session
 */
export const updateSession = async (req, res, next) => {
    try {
        const sessionData = req.body;
        if (!sessionData || !sessionData.sessionID || !sessionData.agentId) {
            return res.status(400).json({ error: 'INVALID_SESSION' });
        }

        await Session.updateOne(
            { sessionID: sessionData.sessionID },
            { $set: sessionData },
            { upsert: true }
        );

        // Reset forceLoggedOut flag when agent clocks in/updates session
        await Agent.updateOne(
            { agentId: sessionData.agentId },
            { $set: { forceLoggedOut: false } }
        );

        res.status(200).json({ ok: true });
    } catch (err) {
        next(err);
    }
};

/**
 * Get all latest sessions for agents
 */
export const getAllSessions = async (req, res, next) => {
    try {
        const sessions = await Session.aggregate([
            { $sort: { updatedAt: -1 } },
            { $group: { _id: '$agentId', latestSession: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$latestSession' } }
        ]);
        res.json(sessions);
    } catch (err) {
        next(err);
    }
};

/**
 * Get current session for a specific agent
 */
export const getCurrentSession = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const session = await Session.findOne({ agentId, clockOutTime: null }).sort({ clockInTime: -1 });

        if (!session) {
            return res.status(404).json({ error: 'NOT_FOUND' });
        }

        res.json(session);
    } catch (err) {
        next(err);
    }
};

/**
 * Force logout an agent
 */
export const forceLogout = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        await Session.updateOne(
            { agentId, clockOutTime: null },
            { $set: { forceLoggedOutAt: Date.now(), clockOutTime: Date.now() } }
        );
        // Set flag on agent document for fallback detection
        await Agent.updateOne(
            { agentId },
            { $set: { forceLoggedOut: true } }
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};
