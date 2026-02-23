export interface OfflineAction {
    id: string; // Unique ID for the action entry
    type: 'FORCE_LOGOUT' | 'CREATE_TICKET';
    payload: any;
    timestamp: number;
}

const DB_NAME = 'RestroBoard_Offline';
const DB_VERSION = 1;
const STORE_NAME = 'actions';

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const addToQueue = async (action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
    const db = await openDB();
    const fullAction: OfflineAction = {
        ...action,
        id: (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now()
    };

    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(fullAction);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getQueue = async (): Promise<OfflineAction[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const removeFromQueue = async (id: string) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const clearQueue = async () => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
