const WebSocket = require('ws');

console.log('[WS SERVER] Starting...');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('[WS SERVER] Client connected');

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    console.log('[WS EVENT]', message.type);

    // Broadcast to all connected clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  });

  ws.on('close', () => {
    console.log('[WS SERVER] Client disconnected');
  });
});

// keep Node process alive
setInterval(() => {}, 1000);

console.log('[WS SERVER] Listening on ws://localhost:8080');
