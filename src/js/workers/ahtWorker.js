/**
 * Average Handle Time (AHT) Analytics Web Worker
 * 
 * Offloads heavy analytics calculations to a Web Worker thread.
 * Prevents blocking the main UI thread during computation.
 * 
 * WHY Web Worker:
 * - CPU-intensive calculations don't block UI
 * - Runs in separate thread (true parallelism)
 * - Can process large datasets without freezing browser
 * 
 * USAGE:
 * const worker = new Worker('/src/js/workers/ahtWorker.js');
 * worker.postMessage({ type: 'calculate', data: [...] });
 */

/**
 * Worker message handler
 * Listens for calculation requests and posts results back
 */
self.onmessage = function(event) {
    const { type, data } = event.data;
    
    switch (type) {
        case 'calculate':
            handleCalculate(data);
            break;
        case 'ping':
            self.postMessage({ type: 'pong' });
            break;
        default:
            console.warn('[AHTWorker] Unknown message type:', type);
    }
};

/**
 * Handles AHT calculation requests
 * @param {Array} callRecords - Array of call records with duration
 */
function handleCalculate(callRecords) {
    console.log('[AHTWorker] Calculating AHT for', callRecords.length, 'records');
    
    try {
        if (!callRecords || callRecords.length === 0) {
            self.postMessage({
                type: 'result',
                result: null,
                error: 'No call records provided'
            });
            return;
        }
        
        // Calculate average handle time
        const totalDuration = callRecords.reduce((sum, record) => {
            return sum + (record.duration || 0);
        }, 0);
        
        const averageHandleTime = totalDuration / callRecords.length;
        
        // Calculate additional metrics (placeholder for future expansion)
        const metrics = {
            average: averageHandleTime,
            count: callRecords.length,
            min: Math.min(...callRecords.map(r => r.duration || 0)),
            max: Math.max(...callRecords.map(r => r.duration || 0)),
            calculatedAt: Date.now()
        };
        
        // Post result back to main thread
        self.postMessage({
            type: 'result',
            result: metrics,
            error: null
        });
        
        console.log('[AHTWorker] Calculation complete:', metrics);
    } catch (error) {
        self.postMessage({
            type: 'result',
            result: null,
            error: error.message
        });
    }
}

/**
 * Worker initialization message
 */
console.log('[AHTWorker] Worker initialized and ready');
