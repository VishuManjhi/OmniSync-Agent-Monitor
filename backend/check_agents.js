import { connectDb } from './db.js';
import Agent from './models/Agent.js';

async function check() {
    await connectDb();
    const agents = await Agent.find({}, { agentId: 1, forceLoggedOut: 1, role: 1 });
    console.log('--- Agent Status ---');
    agents.forEach(a => {
        console.log(`Agent: ${a.agentId} | Role: ${a.role} | ForceLoggedOut: ${a.forceLoggedOut}`);
    });
    process.exit(0);
}

check();
