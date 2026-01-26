/**
 * Long Polling Communication Handler (Mock)
 * 
 * Simulates long polling mechanism for compatibility with legacy systems.
 * Keeps a request open for extended period waiting for server response.
 * 
 * WHY Long Polling:
 * - Fallback when WebSocket/SSE unavailable
 * - Works with older infrastructure
 * - More efficient than short polling
 */

let pollTimeout = null;
let isPolling = false;
let statusCallback = null;
let abortController = null;

const POLL_URL = 'https://api.example.com/longpoll'; // Mock URL
const POLL_TIMEOUT = 30000; // 30 seconds

/**
 * Initializes long polling (mocked)
 * @param {Function} callback - Callback to update status (channel, status)
 */
export function initLongPoll(callback) {
    statusCallback = callback;
    startPolling();
}

/**
 * Starts long polling loop
 */
function startPolling() {
    if (isPolling) {
        return;
    }
    
    isPolling = true;
    statusCallback('lp', 'connecting');
    performLongPoll();
}

/**
 * Performs a single long poll request
 */
async function performLongPoll() {
    abortController = new AbortController();
    
    try {
        // Mock: Simulate long poll request
        statusCallback('lp', 'connected');
        
        // In production:
        // const response = await fetch(POLL_URL, {
        //     method: 'GET',
        //     signal: abortController.signal,
        //     headers: {
        //         'Cache-Control': 'no-cache'
        //     }
        // });
        
        // Mock: Simulate waiting for response
        await new Promise(resolve => setTimeout(resolve, POLL_TIMEOUT));
        
        // Mock: Simulate response received
        console.log('[LongPoll] Mock response received');
        
        // Immediately start next poll
        if (isPolling) {
            performLongPoll();
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('[LongPoll] Request aborted');
        } else {
            console.error('[LongPoll] Poll error:', error);
            statusCallback('lp', 'disconnected');
            
            // Retry after delay
            pollTimeout = setTimeout(() => {
                if (isPolling) {
                    performLongPoll();
                }
            }, 5000);
        }
    }
}

/**
 * Stops long polling
 */
export function stopPolling() {
    isPolling = false;
    
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    
    if (pollTimeout) {
        clearTimeout(pollTimeout);
        pollTimeout = null;
    }
    
    statusCallback('lp', 'disconnected');
}
