import mongoose from 'mongoose';
import { connectDb } from './db.js';
import Ticket from './models/Ticket.js';

async function ensureTextIndex() {
    await connectDb();

    const indexes = await Ticket.collection.indexes();
    const target = indexes.find((item) => item.name === 'ticket_text_search_v1' || item.key?._fts === 'text');

    if (!target) {
        const indexSpec = {
            ticketId: 'text',
            displayId: 'text',
            issueType: 'text',
            'emailMeta.subject': 'text',
            'resolution.notes': 'text',
            description: 'text'
        };

        const indexOptions = {
            name: 'ticket_text_search_v1',
            weights: {
                ticketId: 15,
                displayId: 12,
                issueType: 5,
                'emailMeta.subject': 6,
                'resolution.notes': 2,
                description: 3
            }
        };

        await Ticket.collection.createIndex(indexSpec, indexOptions);
    }

    const refreshed = await Ticket.collection.indexes();
    const ensured = refreshed.find((item) => item.name === 'ticket_text_search_v1' || item.key?._fts === 'text');

    console.log('[INDEX] ticket_text_search_v1 ready:', Boolean(ensured));
    await mongoose.connection.close();
}

ensureTextIndex()
    .then(() => {
        console.log('[INDEX] Done');
        process.exit(0);
    })
    .catch(async (err) => {
        console.error('[INDEX] Failed:', err);
        try {
            await mongoose.connection.close();
        } catch {
            // no-op
        }
        process.exit(1);
    });
