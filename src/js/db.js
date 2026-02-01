const DB_NAME = 'restroDB';
const DB_VERSION = 9;

export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[DB] Failed to open DB', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            const db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (e) => {
            const db = e.target.result;

            console.log('[DB] Upgrade needed → version', DB_VERSION);

            if (!db.objectStoreNames.contains('agent_sessions')) {
                const sessions = db.createObjectStore('agent_sessions', {
                    keyPath: 'sessionID'
                });

                sessions.createIndex('agentId', 'agentId', { unique: false });
                sessions.createIndex('status', 'status', { unique: false });
            }

            if (db.objectStoreNames.contains('tickets')) {
                db.deleteObjectStore('tickets');
            }
            if (!db.objectStoreNames.contains('agents')){
                const store = db.createObjectStore('agents',{
                    keyPath: 'agentId'
                });
                store.createIndex('name', 'name',{unique: false});
            }
            const tickets = db.createObjectStore('tickets', {
                keyPath: 'ticketId' 
            });

            tickets.createIndex('agentId', 'agentId', { unique: false });
            tickets.createIndex('status', 'status', { unique: false });
            tickets.createIndex('issueDateTime', 'issueDateTime', { unique: false });

            if (!db.objectStoreNames.contains('attachments')) {
                const attachments = db.createObjectStore('attachments', {
                    keyPath: 'attachmentId' 
                });

                attachments.createIndex('ticketId', 'ticketId', { unique: false });
                attachments.createIndex('agentId', 'agentId', { unique: false });
                attachments.createIndex('createdAt', 'createdAt', { unique: false });
            }
            if (!db.objectStoreNames.contains('offline_queue')) {
              const queue = db.createObjectStore('offline_queue', {
              keyPath: 'idempotencyKey'
             });

              queue.createIndex('synced', 'synced', { unique: false });
              queue.createIndex('createdAt', 'createdAt', { unique: false });
              queue.createIndex('action', 'action', { unique: false });
            }
        };
    });
}
