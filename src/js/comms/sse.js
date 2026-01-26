import { updateProtocolLED } from '../utils/connectionLED.js';

let eventSource = null;

export function startSSE(onStatus, onData) {
    if (eventSource) return;

    updateProtocolLED('sse', false);

    eventSource = new EventSource('http://localhost:3001/sse/queue-stats');

    eventSource.onopen = () => {
        console.log('[SSE] Connected');
        updateProtocolLED('sse', true);
    };

    eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        onData(data);
    };

    eventSource.onerror = () => {
        console.warn('[SSE] Disconnected');
        updateProtocolLED('sse', false);
        eventSource.close();
        eventSource = null;
    };
}
