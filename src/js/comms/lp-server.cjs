const http = require('http');

console.log('[LP] Server running on port 3002');

// Map of agentId -> { res, timeout }
const pendingResponses = new Map();
// Map of agentId -> list of commands
const commandQueues = new Map();

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, idempotency-key');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Robust parsing regardless of host header
    const url = new URL(req.url, 'http://localhost');

    /* ============================
       1️⃣ Agent Long Poll (GET)
    ============================ */
    if (req.method === 'GET' && url.pathname === '/lp/commands') {
        const agentId = url.searchParams.get('agentId') || 'unknown';
        console.log(`[LP] Agent ${agentId} polling`);

        // If command already in queue, deliver immediately
        const queue = commandQueues.get(agentId) || [];
        if (queue.length > 0) {
            const cmd = queue.shift();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(cmd));
        }

        // Otherwise hold the response
        pendingResponses.set(agentId, res);

        req.on('close', () => {
            if (pendingResponses.get(agentId) === res) {
                pendingResponses.delete(agentId);
            }
        });

        return;
    }

    /* ============================
       2️⃣ Supervisor Whisper (POST)
    ============================ */
    if (req.method === 'POST' && url.pathname === '/lp/whisper') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const agentId = payload.agentId;

                console.log(`[LP] Whisper initiated for ${agentId}:`, payload.type);

                const command = {
                    type: payload.type,
                    agentId,
                    payload: payload.payload || {},
                    issuedAt: Date.now()
                };

                // Deliver immediately if agent is polling
                const pendingRes = pendingResponses.get(agentId);
                if (pendingRes) {
                    pendingRes.writeHead(200, { 'Content-Type': 'application/json' });
                    pendingRes.end(JSON.stringify(command));
                    pendingResponses.delete(agentId);
                } else {
                    // Queue for later
                    if (!commandQueues.has(agentId)) {
                        commandQueues.set(agentId, []);
                    }
                    commandQueues.get(agentId).push(command);
                    console.log(`[LP] Command queued for offline agent: ${agentId}`);
                }

                res.writeHead(200);
                res.end(JSON.stringify({ status: 'WHISPER_QUEUED' }));
            } catch (e) {
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(3002);
setInterval(() => { }, 1000);
