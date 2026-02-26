import jwt from 'jsonwebtoken';
import Agent from '../models/Agent.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vba-default-secret-change-in-prod';
const JWT_EXPIRES = '8h';

/**
 * Handle user login
 */
export const login = async (req, res, next) => {
    try {
        const { id, password } = req.body || {};
        if (!id || !password) {
            return res.status(400).json({ error: 'MISSING_CREDENTIALS' });
        }

        const normalizedId = id.toLowerCase().trim();
        const agent = await Agent.findOne({ agentId: normalizedId });

        let role = null;
        if (!agent) {
            // Fallback for missing DB user (development default)
            if (normalizedId.startsWith('a') && password === 'agent123') role = 'agent';
            else if ((normalizedId === 'admin' || normalizedId.startsWith('sup')) && password === 'sup123') role = 'supervisor';
        } else {
            // DB user: compare password securely
            const isMatch = await agent.comparePassword(password);
            if (isMatch) {
                role = agent.role;
            } else {
                // Fallback for legacy plain-text password check (auto-hashes on first success)
                if (agent.password === password) {
                    role = agent.role;
                    // Update to hashed password
                    agent.password = password;
                    await agent.save();
                } else if (!agent.password) {
                    // No password set at all → fall back to config defaults
                    if (normalizedId.startsWith('a') && password === 'agent123') role = agent.role || 'agent';
                    else if ((normalizedId === 'admin' || normalizedId.startsWith('sup')) && password === 'sup123') role = agent.role || 'supervisor';

                    if (role) {
                        agent.password = password;
                        await agent.save();
                    }
                }
            }
        }

        if (!role) {
            return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
        }

        const payload = { id: normalizedId, role: role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        // Reset forceLoggedOut flag on successful login
        await Agent.updateOne({ agentId: normalizedId }, { $set: { forceLoggedOut: false } });

        res.json({ token, id: normalizedId, role, user: payload });
    } catch (err) {
        next(err); // Pass to global error handler
    }
};
