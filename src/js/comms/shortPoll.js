import { updateProtocolLED } from '../utils/connectionLED.js';

let timer = null;
let controller = null;
let failures = 0;

const BASE_DELAY = 5000;
const MAX_DELAY = 60000;
const REQUEST_TIMEOUT = 3000;
const HEALTH_URL = '/';

function getDelay() {
  return Math.min(BASE_DELAY * Math.pow(2, failures), MAX_DELAY);
}

async function poll() {
  controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });

    if (!res.ok) throw new Error('Health check failed');

    failures = 0;
    updateProtocolLED('sp', true);
    console.log('[SP] Health OK');

  } catch (err) {
    failures++;
    updateProtocolLED('sp', false);
    console.warn('[SP] Health FAIL', err.name);

  } finally {
    clearTimeout(timeout);
    timer = setTimeout(poll, getDelay());
  }
}

export function startShortPolling() {
  if (timer) return;
  failures = 0;
  poll();
}

export function stopShortPolling() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (controller) {
    controller.abort();
    controller = null;
  }
  updateProtocolLED('sp', false);
}
