import express from 'express';
import { incomingEmailWebhook } from '../controllers/webhookController.js';
import { verifyIncomingEmailSignature } from '../middleware/webhookAuth.js';

const router = express.Router();

// Main webhook endpoint with auth
router.post('/incoming-email', verifyIncomingEmailSignature, incomingEmailWebhook);

// Debug endpoint - echoes headers (NO AUTH REQUIRED - remove in production!)
router.post('/debug/headers', (req, res) => {
    res.json({
        message: 'Debug endpoint - echoing headers',
        headers: req.headers,
        body: typeof req.body === 'string' ? req.body.substring(0, 200) : req.body,
        timestamp: new Date(),
        note: 'This endpoint does NOT require authentication. Remove in production!'
    });
});

export default router;
