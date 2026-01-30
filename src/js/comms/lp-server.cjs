const http = require('http');

console.log('[LP] Server running on port 3002');

let pendingResponse = null;
let pendingCommand = null;

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    /* ============================
       1️⃣ Agent Long Poll (GET)
    ============================ */
    if (req.method === 'GET' && req.url === '/lp/commands') {
        console.log('[LP] Agent polling');

        if (pendingCommand) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(pendingCommand));
            pendingCommand = null;
            return;
        }

        pendingResponse = res;

        req.on('close', () => {
            pendingResponse = null;
        });

        return;
    }

    /* ============================
       2️⃣ Supervisor Whisper (POST)
    ============================ */
    if (req.method === 'POST' && req.url === '/lp/whisper') {
        let body = '';

        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const payload = JSON.parse(body);

            console.log('[LP] Whisper initiated:', payload);

            pendingCommand = {
                type: payload.type,
                agentId: payload.agentId,
                issuedAt: Date.now()
            };

            if (pendingResponse) {
                pendingResponse.writeHead(200, {
                    'Content-Type': 'application/json'
                });
                pendingResponse.end(JSON.stringify(pendingCommand));
                pendingResponse = null;
                pendingCommand = null;
            }

            res.writeHead(200);
            res.end(JSON.stringify({ status: 'WHISPER_SENT' }));
        });

        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(3002);
setInterval(() => {}, 1000);
