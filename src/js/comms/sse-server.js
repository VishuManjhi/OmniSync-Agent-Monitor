import http from 'http';

const PORT = 3001;

const server = http.createServer((req, res) => {
    if (req.url === '/sse/queue-stats') {
        // Required SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        console.log('[SSE] Supervisor connected');

        // Send initial comment to keep connection alive
        res.write(': connected\n\n');

        const interval = setInterval(() => {
            const snapshot = {
                timestamp: Date.now(),
                queueDepth: Math.floor(Math.random() * 40),
                waitingCalls: Math.floor(Math.random() * 15),
                activeAgents: Math.floor(5 + Math.random() * 10),
                slaPercent: Math.floor(85 + Math.random() * 10)
            };

            res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
        }, 3000);

        req.on('close', () => {
            console.log('[SSE] Supervisor disconnected');
            clearInterval(interval);
        });

        return;
    }

    // Non-SSE routes
    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(` SSE server running on http://localhost:${PORT}`);
});
