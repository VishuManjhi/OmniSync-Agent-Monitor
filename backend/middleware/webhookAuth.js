import { verifyPostmarkSignature } from '../services/emailIngestService.js';

export function verifyIncomingEmailSignature(req, res, next) {
    try {
        const postmarkServerToken = String(req.headers['x-postmark-server-token'] || '').trim();
        const expectedToken = String(process.env.POSTMARK_SERVER_TOKEN || '').trim();
        const authHeader = String(req.headers.authorization || '').trim();
        const queryToken = String(req.query.token || req.query.webhookToken || '').trim();
        const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
            ? authHeader.slice(7).trim()
            : '';
        
        // Log all headers for debugging
        console.log('[WebhookAuth] Incoming request headers:', {
            'x-postmark-server-token': postmarkServerToken ? '***' : '(missing)',
            'x-postmark-signature': req.headers['x-postmark-signature'] ? '***' : '(missing)',
            'x-webhook-signature': req.headers['x-webhook-signature'] ? '***' : '(missing)',
            'authorization': bearerToken ? 'Bearer ***' : '(missing)',
            'query-token': queryToken ? '***' : '(missing)',
            'all-header-keys': Object.keys(req.headers)
        });
        
        // Check shared token first (primary auth method)
        if (expectedToken) {
            const headerTokenMatch = postmarkServerToken && postmarkServerToken === expectedToken;
            const bearerTokenMatch = bearerToken && bearerToken === expectedToken;
            const queryTokenMatch = queryToken && queryToken === expectedToken;

            console.log('[WebhookAuth] Shared token check:', {
                headerTokenMatch,
                bearerTokenMatch,
                queryTokenMatch,
                tokenLength: postmarkServerToken ? postmarkServerToken.length : bearerToken ? bearerToken.length : 0
            });

            if (headerTokenMatch) {
                console.log('[WebhookAuth] ✓ Authorized via X-Postmark-Server-Token');
                return next();
            }

            if (bearerTokenMatch) {
                console.log('[WebhookAuth] ✓ Authorized via Authorization Bearer token');
                return next();
            }

            if (queryTokenMatch) {
                console.log('[WebhookAuth] ✓ Authorized via query token');
                return next();
            }
        }
        
        // Fallback to HMAC signature verification
        const signature = String(req.headers['x-postmark-signature'] || req.headers['x-webhook-signature'] || '').trim();
        const rawBody = req.rawBody || JSON.stringify(req.body || {});
        
        console.log('[WebhookAuth] Attempting HMAC verification:', {
            signaturePresent: !!signature,
            rawBodyLength: rawBody.length,
            rawBody: rawBody.substring(0, 100) + '...'
        });
        
        const valid = verifyPostmarkSignature(rawBody, signature);
        if (valid) {
            console.log('[WebhookAuth] ✓ Authorized via HMAC signature');
            return next();
        }
        
        console.log('[WebhookAuth] ✗ Authorization failed - both token and signature invalid');
        return res.status(401).json({ 
            error: 'INVALID_WEBHOOK_SIGNATURE',
            debug: {
                tokenPresent: !!postmarkServerToken,
                bearerTokenPresent: !!bearerToken,
                queryTokenPresent: !!queryToken,
                signaturePresent: !!signature,
                expectedHeader: 'X-Postmark-Server-Token',
                alternateHeader: 'Authorization: Bearer <POSTMARK_SERVER_TOKEN>',
                alternateQuery: '?token=<POSTMARK_SERVER_TOKEN>',
                method: 'none'
            }
        });
    } catch (err) {
        console.error('[WebhookAuth] Error during signature verification:', err);
        next(err);
    }
}
