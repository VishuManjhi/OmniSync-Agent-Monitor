/**
 * Event Loop Diagnostics
 * 
 * Logs synchronous code, Promise microtasks, and setTimeout macrotasks
 * to help debug performance and understand JavaScript event loop behavior.
 * 
 * WHY this matters:
 * - Blocking synchronous code delays UI updates
 * - Microtasks (Promises) run before macrotasks (setTimeout)
 * - Understanding event loop helps optimize performance
 */

let diagnosticsEnabled = false;

/**
 * Sets up event loop diagnostics logging
 * Logs different types of execution to console
 */
export function setupDiagnostics() {
    if (diagnosticsEnabled) {
        console.log('[EventLoopDebug] Diagnostics already enabled');
        return;
    }
    
    diagnosticsEnabled = true;
    console.log('[EventLoopDebug] Starting diagnostics...');
    
    // Log synchronous code execution
    logSynchronous();
    
    // Monitor Promise microtasks
    logMicrotasks();
    
    // Monitor setTimeout macrotasks
    logMacrotasks();
}

/**
 * Logs synchronous code execution
 */
function logSynchronous() {
    console.log('[EventLoopDebug] Synchronous code block starting');
    
    // Example synchronous operations
    for (let i = 0; i < 5; i++) {
        console.log(`[EventLoopDebug] Sync: ${i}`);
    }
    
    console.log('[EventLoopDebug] Synchronous code block complete');
}

/**
 * Demonstrates and logs Promise microtask behavior
 * Microtasks execute before any macrotasks
 */
function logMicrotasks() {
    console.log('[EventLoopDebug] Setting up Promise microtasks...');
    
    Promise.resolve().then(() => {
        console.log('[EventLoopDebug] Microtask 1 executed');
    });
    
    Promise.resolve().then(() => {
        console.log('[EventLoopDebug] Microtask 2 executed');
    });
    
    console.log('[EventLoopDebug] Promise microtasks queued');
}

/**
 * Demonstrates and logs setTimeout macrotask behavior
 * Macrotasks execute after all microtasks complete
 */
function logMacrotasks() {
    console.log('[EventLoopDebug] Setting up setTimeout macrotasks...');
    
    setTimeout(() => {
        console.log('[EventLoopDebug] Macrotask 1 executed (setTimeout 0ms)');
    }, 0);
    
    setTimeout(() => {
        console.log('[EventLoopDebug] Macrotask 2 executed (setTimeout 10ms)');
    }, 10);
    
    console.log('[EventLoopDebug] setTimeout macrotasks scheduled');
    
    // Expected order:
    // 1. All synchronous code
    // 2. All microtasks (Promises)
    // 3. Macrotasks (setTimeout) in order
}

/**
 * Measures execution time of a function
 * Useful for identifying slow synchronous operations
 * @param {Function} fn - Function to measure
 * @param {string} label - Label for logging
 */
export function measureExecution(fn, label = 'Function') {
    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`[EventLoopDebug] ${label} took ${(end - start).toFixed(2)}ms`);
    return end - start;
}
