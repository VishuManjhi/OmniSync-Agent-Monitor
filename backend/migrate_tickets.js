import { connectDb } from './db.js';
import Ticket from './models/Ticket.js';

async function migrate() {
    try {
        console.log('Connecting to database...');
        await connectDb();

        console.log('Starting Ticket ID migration...');
        const tickets = await Ticket.find({ displayId: { $exists: false } });
        console.log(`Found ${tickets.length} tickets needing migration.`);

        for (const ticket of tickets) {
            const displayId = `${ticket.issueType}-${ticket.agentId || 'UNKNOWN'}-${Math.floor(100 + Math.random() * 899)}`.toUpperCase();
            await Ticket.updateOne({ _id: ticket._id }, { $set: { displayId } });
            console.log(`Migrated ${ticket.ticketId} -> ${displayId}`);
        }

        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
