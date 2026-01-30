import { updateProtocolLED } from '../utils/connectionLED.js';

let running = false;

export function startLongPolling(onCommand) {
    if (running) return;
    running = true;

    updateProtocolLED('lp', true);

    async function poll() {
        try {
            const res = await fetch('http://localhost:3002/lp/commands', {
                cache: 'no-store'
            });

            // 🔑 Case 1: command delivered
            if (res.status === 200) {
                const command = await res.json();
                console.log('[LP] Command received:', command);
                onCommand?.(command);
            }

            // 🔑 Case 2: no command (idle poll)
            else if (res.status === 204) {
                // normal long-poll timeout, do nothing
            }

            else {
                throw new Error(`LP HTTP ${res.status}`);
            }

        } catch (err) {
            console.warn('[LP] Error', err.message);
            updateProtocolLED('lp', false);
            await new Promise(r => setTimeout(r, 3000));
            updateProtocolLED('lp', true);
        } finally {
            // 🔑 ALWAYS re-poll
            setTimeout(poll, 0);
        }
    }

    poll();
}
