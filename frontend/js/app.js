import { openDB } from './db.js';
import * as state from './state.js';
import * as supervisor from './supervisor.js';
import * as offlineQueue from './offlineQueue.js';
import { startShortPolling } from './comms/shortPoll.js';




async function initApp() {
    try {
        console.log('Opening database');
        const db = await openDB();
        console.log('Database opened successfully');
        await offlineQueue.initialize(db);
        console.log('Initializing runtime state');
        state.initialize();
        console.log('Runtime state initialized');
        setupUIHandlers();
            
        console.log('Initializing supervisor dashboard');
        await supervisor.initialize(db);
        console.log('Supervisor dashboard initialized');
        
        console.log('Application initialized successfully');
        startShortPolling();
    } catch (error) {
        console.error('[Initialization failed:', error);
    }
}
function setupUIHandlers() {}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
