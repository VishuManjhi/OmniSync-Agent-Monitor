import mongoose from 'mongoose';
import Agent from './backend/models/Agent.js';

const MONGO_URI = 'mongodb://127.0.0.1:27017/restroDB';

async function checkAgents() {
    try {
        console.log('Connecting to:', MONGO_URI);
        await mongoose.connect(MONGO_URI);
        const agents = await Agent.find({}, { agentId: 1, role: 1, name: 1 });
        console.log('--- AGENTS IN DB ---');
        console.log(JSON.stringify(agents, null, 2));
        console.log('--------------------');
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkAgents();
