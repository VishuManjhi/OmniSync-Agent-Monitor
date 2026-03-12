import { ingestIncomingEmail } from '../services/emailIngestService.js';

export const incomingEmailWebhook = async (req, res, next) => {
    try {
        const result = await ingestIncomingEmail(req.body || {});
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};
