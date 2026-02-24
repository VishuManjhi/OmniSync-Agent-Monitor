import mongoose from 'mongoose';
import Ticket from './models/Ticket.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restroDB';

async function check() {
    try {
        await mongoose.connect(MONGODB_URI);
        const count = await Ticket.countDocuments({});
        console.log('Total tickets in system:', count);

        const tickets = await Ticket.find({});
        console.log('Sample ticket agentIds:', tickets.slice(0, 5).map(t => t.agentId));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
