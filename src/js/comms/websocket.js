import { updateProtocolLED } from '../utils/connectionLED.js';

let socket = null;
let listeners = new Set();


export function initWebSocket(onMessage) {
    if (typeof onMessage === 'function') {
        listeners.add(onMessage);
    }

    if (!socket) {
        socket = new WebSocket('ws://localhost:8080');

        updateProtocolLED('ws', false);

        socket.onopen = () => {
            console.log('[WS] Connected');
            updateProtocolLED('ws', true);
        };

        socket.onmessage = async (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch {
                return;
            }

            // simulate async workload (event loop demo)
            await new Promise(r => setTimeout(r, 100));

            listeners.forEach(fn => {
                try {
                    fn(data);
                } catch (err) {
                    console.error('[WS listener error]', err);
                }
            });
        };

        socket.onerror = (err) => {
            console.error('[WS] Error', err);
            updateProtocolLED('ws', false);
        };

        socket.onclose = () => {
            console.warn('[WS] Disconnected');
            updateProtocolLED('ws', false);
            socket = null;
            listeners.clear();
        };
    }

    return socket;
}

/**
 * Send WS message
 */
export function sendMessage(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('[WS] Not connected, skipping send', message);
        updateProtocolLED('ws', false);
        return;
    }

    socket.send(JSON.stringify(message));
}
