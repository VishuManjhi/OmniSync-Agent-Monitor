/**
 * Memory Diagnostics Utilities
 * 
 * Provides utilities to monitor memory usage and detect potential leaks.
 * Uses Performance API and memory profiling where available.
 * 
 * WHY memory debugging:
 * - Large datasets can cause memory issues
 * - DOM nodes can leak if not properly cleaned up
 * - IndexedDB operations can accumulate memory
 */

/**
 * Gets current memory usage statistics
 * @returns {Object} Memory stats object
 */
export function getMemoryStats() {
    if (!performance.memory) {
        return {
            available: false,
            message: 'Memory API not available in this browser'
        };
    }
    
    return {
        available: true,
        usedJSHeapSize: formatBytes(performance.memory.usedJSHeapSize),
        totalJSHeapSize: formatBytes(performance.memory.totalJSHeapSize),
        jsHeapSizeLimit: formatBytes(performance.memory.jsHeapSizeLimit),
        percentageUsed: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2) + '%'
    };
}

/**
 * Formats bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Logs current memory statistics to console
 */
export function logMemoryStats() {
    const stats = getMemoryStats();
    
    if (!stats.available) {
        console.warn('[MemoryDebug] Memory API not available');
        return;
    }
    
    console.group('[MemoryDebug] Memory Statistics');
    console.log('Used JS Heap:', stats.usedJSHeapSize);
    console.log('Total JS Heap:', stats.totalJSHeapSize);
    console.log('JS Heap Limit:', stats.jsHeapSizeLimit);
    console.log('Percentage Used:', stats.percentageUsed);
    console.groupEnd();
}

/**
 * Monitors memory usage over time
 * Logs stats at regular intervals
 * @param {number} intervalMs - Interval in milliseconds
 * @returns {Function} Stop function to cancel monitoring
 */
export function monitorMemory(intervalMs = 10000) {
    console.log(`[MemoryDebug] Starting memory monitoring (interval: ${intervalMs}ms)`);
    
    const intervalId = setInterval(() => {
        logMemoryStats();
    }, intervalMs);
    
    // Return stop function
    return () => {
        clearInterval(intervalId);
        console.log('[MemoryDebug] Memory monitoring stopped');
    };
}

/**
 * Estimates number of DOM nodes
 * @returns {number} Approximate DOM node count
 */
export function getDOMNodeCount() {
    return document.querySelectorAll('*').length;
}

/**
 * Logs DOM-related memory statistics
 */
export function logDOMMemory() {
    const nodeCount = getDOMNodeCount();
    console.log(`[MemoryDebug] DOM Nodes: ${nodeCount}`);
    
    // Count agent cards specifically
    const agentCards = document.querySelectorAll('.agent-card').length;
    if (agentCards > 0) {
        console.log(`[MemoryDebug] Agent Cards: ${agentCards}`);
    }
}
