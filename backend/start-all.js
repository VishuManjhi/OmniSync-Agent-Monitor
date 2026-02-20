import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seedDatabase() {
    try {
        const db = await getDb();
        const agentsCol = db.collection('agents');
        
        // Check if already seeded
        const count = await agentsCol.countDocuments();
        if (count > 0) {
            console.log('[SEED] Database already has data, skipping seed.');
            return;
        }

        await agentsCol.deleteMany({});
        const agents = [
            { agentId: 'a1', name: 'Vishu' },
            { agentId: 'a2', name: 'Rashi' },
            { agentId: 'a3', name: 'Aryan' },
            { agentId: 'a4', name: 'Sameer' }
        ];
        await agentsCol.insertMany(agents);

        const supervisorsCol = db.collection('supervisors');
        await supervisorsCol.deleteMany({});
        const supervisors = [
            { id: 'admin', name: 'Supervisor', role: 'supervisor' },
            { id: 'sup1', name: 'Ops Lead', role: 'supervisor' }
        ];
        await supervisorsCol.insertMany(supervisors);
        
        console.log('[SEED] Database seeded successfully');
    } catch (err) {
        console.error('[SEED] Error:', err);
    }
}

const servers = [
    { name: 'API Server', path: './servers/api-server.js' },
    { name: 'WS Server', path: './servers/ws-server.js' }
];

// Seed first, then start servers
await seedDatabase();

servers.forEach(server => {
    console.log(`Starting ${server.name}...`);
    const child = spawn('node', [server.path], {
        stdio: 'inherit',
        cwd: __dirname
    });

    child.on('error', (err) => {
        console.error(`Failed to start ${server.name}:`, err);
    });

    child.on('exit', (code) => {
        if (code !== 0) {
            console.log(`${server.name} exited with code ${code}`);
        }
    });

    // Cleanup on parent exit
    const cleanup = () => {
        console.log(`Killing ${server.name}...`);
        child.kill();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
});

console.log('API server initiated. You can now open login.html in your browser.');
