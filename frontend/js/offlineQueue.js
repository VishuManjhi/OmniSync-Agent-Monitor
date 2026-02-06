import { generateIdempotencyKey } from './utils/idempotency.js';


let db = null;
let isOnline = navigator.onLine;
let replayInProgress = false;

//Initialize offline queue
export async function initialize(database) {
    db = database;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (isOnline) {
        replayPendingActions();
    }
}
//queue action offline
export async function queueAction(action, payload, idempotencyKey = null) {
    const key = idempotencyKey || generateIdempotencyKey(action, payload);

    const tx = db.transaction(['offline_queue'], 'readwrite');
    const store = tx.objectStore('offline_queue');

    const item = {
        idempotencyKey: key,
        action,
        payload,
        synced: false,
        createdAt: Date.now()
    };

    try {
        store.add(item);
        console.log(`[OfflineQueue] Queued action: ${action}`, key);
    } catch (err) {
        console.warn('[OfflineQueue] Duplicate action skipped', key);
    }

    updateSyncBadgeCount();

    if (isOnline && !replayInProgress) {
        replayPendingActions();
    }

    return key;
}
//replay all unsynced options on online 
async function replayPendingActions() {
    if (replayInProgress || !isOnline) return;

    replayInProgress = true;
    console.log('[OfflineQueue] Starting replay of pending actions');

    try {
        while (true) {
            // 1️⃣ Read ONE unsynced item
            const item = await new Promise((resolve, reject) => {
                const tx = db.transaction(['offline_queue'], 'readonly');
                const store = tx.objectStore('offline_queue');

                const req = store.openCursor();

                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (!cursor) return resolve(null);

                    if (cursor.value.synced === false) {
                        resolve(cursor.value);
                    } else {
                        cursor.continue();
                    }
                };

                req.onerror = () => reject(req.error);
            });

            // Nothing left
            if (!item) {
                console.log('[OfflineQueue] Replay completed');
                replayInProgress = false;
                return;
            }

            // 2️⃣ Execute network action
            await executeAction(item.action, item.payload, item.idempotencyKey);

            // 3️⃣ Mark as synced
            await new Promise((resolve, reject) => {
                const tx = db.transaction(['offline_queue'], 'readwrite');
                const store = tx.objectStore('offline_queue');

                item.synced = true;
                store.put(item);

                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });

            console.log(`[OfflineQueue] Synced action: ${item.action}`);
        }
    } catch (err) {
        replayInProgress = false;
        console.error('[OfflineQueue] Replay failed, will retry later', err);
    }
}

// execute queued action  (wired with LP)
async function executeAction(action, payload, idempotencyKey) {
    if (action === 'FORCE_LOGOUT') {
        await fetch('http://localhost:3002/lp/whisper', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey
            },
            body: JSON.stringify(payload)
        });
    }
}
//sync badge helpers
async function updateSyncBadgeCount() {
    try {
        const count = await getPendingCount();
        const { updateSyncBadge } = await import('../app.js');
        updateSyncBadge(count);
    } catch {
        // Offline or module unavailable then silently ignore
    }
}


//networkHandlers
async function handleOnline() {
    isOnline = true;
    console.log('[OfflineQueue] Online replaying queue');
    replayPendingActions();
}

function handleOffline() {
    isOnline = false;
    console.log('[OfflineQueue] Offline queuing actions');
}
