import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

console.log('[WS] WebSocket Server listening on port 8080');

wss.on('connection', (ws) => {
    console.log('[WS] New connection');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('[WS] Received:', data.type);

            // Broadcast to all clients
            wss.clients.forEach((client) => {
                if (client.readyState === 1) { // 1 is OPEN
                    client.send(JSON.stringify(data));
                }
            });
        } catch (err) {
            console.error('[WS] Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Connection closed');
    });
});
