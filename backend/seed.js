import { getDb } from './db.js';

async function seed() {
    try {
        const db = await getDb();

        // 1. Seed Agents
        const agentsCol = db.collection('agents');
        await agentsCol.deleteMany({}); // Clear existing

        const agents = [
            { agentId: 'a1', name: 'Vishu' },
            { agentId: 'a2', name: 'Jane Smith' },
            { agentId: 'a3', name: 'Michael Brown' },
            { agentId: 'a4', name: 'Emily Davis' },
            { agentId: 'a5', name: 'Chris Wilson' },
            { agentId: 'a6', name: 'Sarah Miller' },
            { agentId: 'a7', name: 'David Taylor' },
            { agentId: 'a8', name: 'Jessica Anderson' },
            { agentId: 'a9', name: 'Ryan Thomas' },
            { agentId: 'a10', name: 'Ashley Jackson' }
        ];

        await agentsCol.insertMany(agents);
        console.log('[SEED] Agents seeded successfully');

        // 2. Seed Supervisors (Optional, if we want a formal collection)
        const supervisorsCol = db.collection('supervisors');
        await supervisorsCol.deleteMany({}); // Clear existing

        const supervisors = [
            { id: 'admin', name: 'Supervisor', role: 'supervisor' },
            { id: 'sup1', name: 'Ops Lead', role: 'supervisor' }
        ];

        await supervisorsCol.insertMany(supervisors);
        console.log('[SEED] Supervisors seeded successfully');

        process.exit(0);
    } catch (err) {
        console.error('[SEED] Error seeding database:', err);
        process.exit(1);
    }
}

seed();
