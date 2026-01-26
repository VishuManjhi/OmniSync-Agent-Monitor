/**
 * Short Polling / Health Check Handler
 * 
 * Performs periodic health checks with AbortController for cancellation.
 * Used as fallback or for simple status checks.
 * 
 * WHY Short Polling:
 * - Simplest communication pattern
 * - Works everywhere
 * - AbortController allows cancellation (modern approach)
 */

let pollInterval = null;
let abortController = null;
let statusCallback = null;

const HEALTH_CHECK_URL = 'https://api.example.com/health'; // Mock URL
const POLL_INTERVAL = 60000; // 60 seconds

/**
 * Initializes short polling health checks
 * @param {Function} callback - Callback to update status (channel, status)
 */
export function initShortPoll(callback) {
    statusCallback = callback;
    startPolling();
}

/**
 * Starts periodic health check polling
 */
function startPolling() {
    // Initial check
    performHealthCheck();
    
    // Schedule periodic checks
    pollInterval = setInterval(() => {
        performHealthCheck();
    }, POLL_INTERVAL);
}

/**
 * Performs a single health check request
 * Uses AbortController for clean cancellation
 */
async function performHealthCheck() {
    // Abort previous request if still pending
    if (abortController) {
        abortController.abort();
    }
    
    abortController = new AbortController();
    
    try {
        statusCallback('sp', 'connecting');
        
        // Mock: Simulate health check
        // In production:
        // const response = await fetch(HEALTH_CHECK_URL, {
        //     method: 'GET',
        //     signal: abortController.signal,
        //     cache: 'no-cache'
        // });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock: Simulate successful response
        const isHealthy = true; // response.ok
        
        if (isHealthy) {
            statusCallback('sp', 'connected');
            console.log('[ShortPoll] Health check passed');
        } else {
            statusCallback('sp', 'disconnected');
            console.warn('[ShortPoll] Health check failed');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            // Request was cancelled, ignore
            console.log('[ShortPoll] Request aborted');
        } else {
            statusCallback('sp', 'disconnected');
            console.error('[ShortPoll] Health check error:', error);
        }
    }
}

/**
 * Stops health check polling
 */
export function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    
    statusCallback('sp', 'disconnected');
}
