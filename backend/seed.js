import { getDb } from './db.js';

async function seed() {
    try {
        const db = await getDb();

        // 1. Seed Agents
        const agentsCol = db.collection('agents');
        await agentsCol.deleteMany({}); // Clear existing

        const agents = [
            { agentId: 'a1', name: 'Vishu' },
            { agentId: 'a2', name: 'JRashi' },
            { agentId: 'a3', name: 'Aryan' },
            { agentId: 'a4', name: 'Sameer' }
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
