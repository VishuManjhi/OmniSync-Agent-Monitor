import * as state from './state.js';
import * as supervisor from './supervisor.js';

async function initApp() {
    try {
        console.log('Initializing runtime state');
        state.initialize();
        console.log('Runtime state initialized');
        setupUIHandlers();
            
        console.log('Initializing supervisor dashboard');
        await supervisor.initialize();
        console.log('Supervisor dashboard initialized');
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Initialization failed:', error);
    }
}
function setupUIHandlers() {}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
