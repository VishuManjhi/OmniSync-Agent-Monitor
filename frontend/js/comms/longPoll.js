import { updateProtocolLED } from '../utils/connectionLED.js';

let running = false;

export function startLongPolling(onCommand, context = {}) {
    if (running) return;
    running = true;

    updateProtocolLED('lp', true);

    const agentId = context.agentId || 'unknown';

    async function poll() {
        try {
            const url = new URL('http://localhost:3002/lp/commands');
            url.searchParams.append('agentId', agentId);

            const res = await fetch(url, {
                cache: 'no-store'
            });

            //  Case 1: command delivered
            if (res.status === 200) {
                const command = await res.json();
                console.log(`[LP] Command received for ${agentId}:`, command);
                onCommand?.(command);
            }
            //  Case 2: no command (idle poll) or timeout
            else if (res.status === 204) {
                // idle
            }
            else {
                throw new Error(`LP HTTP ${res.status}`);
            }

        } catch (err) {
            console.warn(`[LP] Error for ${agentId}:`, err.message);
            updateProtocolLED('lp', false);
            await new Promise(r => setTimeout(r, 3000));
            updateProtocolLED('lp', true);
        } finally {
            setTimeout(poll, 0);
        }
    }

    poll();
}
