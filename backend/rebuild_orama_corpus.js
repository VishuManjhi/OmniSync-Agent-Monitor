import mongoose from 'mongoose';
import { connectDb } from './db.js';
import { rebuildOramaCorpus } from './services/oramaIndexService.js';

async function run() {
    await connectDb();
    const result = await rebuildOramaCorpus();
    console.log('[ORAMA] Rebuild complete. Documents indexed:', result.indexed);
    await mongoose.connection.close();
}

run()
    .then(() => {
        console.log('[ORAMA] Done');
        process.exit(0);
    })
    .catch(async (err) => {
        console.error('[ORAMA] Failed:', err);
        try {
            await mongoose.connection.close();
        } catch {
            // no-op
        }
        process.exit(1);
    });
