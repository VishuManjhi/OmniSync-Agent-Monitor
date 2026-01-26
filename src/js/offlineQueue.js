/**
 * Offline Queue Manager with Idempotency
 * 
 * Handles queuing actions when offline and replaying them when online.
 * Uses idempotency keys to prevent duplicate execution of actions.
 * 
 * WHY idempotency:
 * - Network retries can cause duplicate requests
 * - User actions can be triggered multiple times
 * - Replay operations must be safe to execute multiple times
 */

import { generateIdempotencyKey } from './utils/idempotency.js';

let db = null;
let isOnline = navigator.onLine;
let replayInProgress = false;

/**
 * Initializes the offline queue manager
 * @param {IDBDatabase} database - IndexedDB instance
 */
export async function initialize(database) {
    db = database;
    
    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // If already online, attempt to replay any pending items
    if (isOnline) {
        await replayPendingActions();
    }
}

/**
 * Queues an action for later execution when online
 * @param {string} action - Action type (e.g., 'clockIn', 'createIncident')
 * @param {Object} payload - Action payload
 * @param {string} idempotencyKey - Optional idempotency key (generated if not provided)
 * @returns {Promise<string>} The idempotency key used
 */
export async function queueAction(action, payload, idempotencyKey = null) {
    const key = idempotencyKey || generateIdempotencyKey(action, payload);
    
    // Check if action with this key already exists (idempotency check)
    const exists = await checkKeyExists(key);
    if (exists) {
        console.log(`[OfflineQueue] Action with key ${key} already queued, skipping`);
        return key;
    }
    
    // Store in offline queue
    const transaction = db.transaction(['offline_queue'], 'readwrite');
    const store = transaction.objectStore('offline_queue');
    
    const queueItem = {
        idempotencyKey: key,
        action,
        payload,
        synced: false,
        createdAt: Date.now(),
        retryCount: 0
    };
    
    await new Promise((resolve, reject) => {
        const request = store.add(queueItem);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    
    console.log(`[OfflineQueue] Queued action: ${action} with key: ${key}`);
    
    // If online, attempt immediate sync
    if (isOnline && !replayInProgress) {
        await replayPendingActions();
    }
    
    return key;
}

/**
 * Checks if an idempotency key already exists in the queue
 * @param {string} key - Idempotency key
 * @returns {Promise<boolean>} True if key exists
 */
async function checkKeyExists(key) {
    const transaction = db.transaction(['offline_queue'], 'readonly');
    const store = transaction.objectStore('offline_queue');
    
    return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result !== undefined);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Replays all pending actions when coming back online
 * Processes items in order and marks them as synced
 */
async function replayPendingActions() {
    if (replayInProgress) {
        console.log('[OfflineQueue] Replay already in progress, skipping');
        return;
    }
    
    if (!isOnline) {
        console.log('[OfflineQueue] Still offline, cannot replay');
        return;
    }
    
    replayInProgress = true;
    console.log('[OfflineQueue] Starting replay of pending actions...');
    
    try {
        // Get all unsynced items, ordered by createdAt
        const transaction = db.transaction(['offline_queue'], 'readwrite');
        const store = transaction.objectStore('offline_queue');
        const index = store.index('synced');
        
        const request = index.openCursor(IDBKeyRange.only(false));
        
        request.onsuccess = async (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                replayInProgress = false;
                console.log('[OfflineQueue] Replay completed');
                await updateSyncBadgeCount();
                return;
            }
            
            const item = cursor.value;
            
            try {
                // Execute the action (mock for now - placeholder)
                await executeAction(item.action, item.payload, item.idempotencyKey);
                
                // Mark as synced
                item.synced = true;
                cursor.update(item);
                
                console.log(`[OfflineQueue] Synced action: ${item.action} (${item.idempotencyKey})`);
            } catch (error) {
                console.error(`[OfflineQueue] Failed to sync action ${item.idempotencyKey}:`, error);
                item.retryCount++;
                // Keep unsynced for retry (future: exponential backoff, max retries)
                cursor.update(item);
            }
            
            cursor.continue();
        };
        
        request.onerror = () => {
            replayInProgress = false;
            console.error('[OfflineQueue] Error during replay:', request.error);
        };
    } catch (error) {
        replayInProgress = false;
        console.error('[OfflineQueue] Replay failed:', error);
    }
}

/**
 * Executes a queued action (placeholder - will be implemented with actual API calls)
 * @param {string} action - Action type
 * @param {Object} payload - Action payload
 * @param {string} idempotencyKey - Idempotency key
 */
async function executeAction(action, payload, idempotencyKey) {
    // Placeholder: Mock network request
    console.log(`[OfflineQueue] Executing ${action} with key ${idempotencyKey}:`, payload);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Future: Make actual API call here with idempotency key in headers
    // Example: await fetch('/api/actions', {
    //     method: 'POST',
    //     headers: {
    //         'Idempotency-Key': idempotencyKey,
    //         'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify({ action, payload })
    // });
}

/**
 * Gets count of pending (unsynced) actions
 * @returns {Promise<number>} Count of unsynced actions
 */
export async function getPendingCount() {
    const transaction = db.transaction(['offline_queue'], 'readonly');
    const store = transaction.objectStore('offline_queue');
    const index = store.index('synced');
    
    return new Promise((resolve, reject) => {
        const request = index.count(IDBKeyRange.only(false));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Updates the sync badge counter in the UI
 */
async function updateSyncBadgeCount() {
    const count = await getPendingCount();
    const { updateSyncBadge } = await import('../app.js');
    updateSyncBadge(count);
}

/**
 * Handles online event - triggers replay
 */
async function handleOnline() {
    isOnline = true;
    console.log('[OfflineQueue] Online - starting replay');
    await replayPendingActions();
}

/**
 * Handles offline event - stops replay attempts
 */
function handleOffline() {
    isOnline = false;
    console.log('[OfflineQueue] Offline - actions will be queued');
}
