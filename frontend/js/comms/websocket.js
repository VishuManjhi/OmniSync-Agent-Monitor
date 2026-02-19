let socket = null;
let listeners = [];

export function initWebSocket(onMessage) {
    if (socket && socket.readyState === WebSocket.OPEN) return;

    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        console.log('[WS] Connected to server');
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (onMessage) onMessage(data);
            listeners.forEach(l => l(data));
        } catch (err) {
            console.error('[WS] Error parsing message:', err);
        }
    };

    socket.onclose = () => {
        console.log('[WS] Disconnected. Reconnecting in 3s...');
        setTimeout(() => initWebSocket(onMessage), 3000);
    };
}

export function sendMessage(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    } else {
        console.warn('[WS] Cannot send. Socket not open.');
    }
}

export function addWSListener(callback) {
    listeners.push(callback);
}
