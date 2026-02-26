import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_RESTARTS = 5;
let shuttingDown = false;

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'vba-dev-secret';
    console.warn('[STARTER] JWT_SECRET not set. Using local development fallback.');
}

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

function startServer(server, attempt = 0) {
    console.log(`Starting ${server.name}${attempt > 0 ? ` (retry ${attempt})` : ''}...`);

    const child = spawn('node', [server.path], {
        stdio: 'inherit',
        cwd: __dirname,
        env: { ...process.env }
    });

    child.on('error', (err) => {
        console.error(`Failed to start ${server.name}:`, err);
    });

    child.on('exit', (code, signal) => {
        if (shuttingDown) return;

        if (code !== 0) {
            console.log(`${server.name} exited with code ${code}${signal ? `, signal ${signal}` : ''}`);
        }

        if ((code !== 0 || signal) && attempt < MAX_RESTARTS) {
            setTimeout(() => startServer(server, attempt + 1), 1500);
        }
    });

    return child;
}

const children = [];

function cleanup() {
    shuttingDown = true;
    children.forEach(({ name, child }) => {
        if (!child.killed) {
            console.log(`Killing ${name}...`);
            child.kill();
        }
    });
}

// Seed first, then start servers
await seedDatabase();

servers.forEach(server => {
    const child = startServer(server);
    children.push({ name: server.name, child });
});

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log('API server initiated. You can now open login.html in your browser.');
