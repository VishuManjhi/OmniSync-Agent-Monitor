import mongoose from 'mongoose';
import Ticket from './models/Ticket.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/restroDB';

function normalize(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

async function run() {
  await mongoose.connect(MONGO_URI);

  const resolved = await Ticket.find({ status: 'RESOLVED' }).sort({ updatedAt: -1 }).lean();
  let updated = 0;

  for (const ticket of resolved) {
    const hasResolution = !!ticket?.resolution?.notes;
    if (hasResolution) continue;

    const candidates = [];
    if (ticket?.description) candidates.push(ticket.description);

    const outboundReplies = (ticket?.emailMeta?.replies || []).filter((r) => r.direction === 'outbound');
    for (const reply of outboundReplies) {
      if (reply?.note) candidates.push(reply.note);
      else if (reply?.message) candidates.push(reply.message);
    }

    const picked = normalize(candidates.find((item) => normalize(item).length >= 12));
    if (!picked) continue;

    await Ticket.updateOne(
      { _id: ticket._id },
      {
        $set: {
          resolution: {
            status: 'AUTO_BACKFILLED',
            notes: picked,
            timestamp: Date.now()
          }
        }
      }
    );

    updated += 1;
  }

  console.log(JSON.stringify({ ok: true, resolvedScanned: resolved.length, resolutionBackfilled: updated }));
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
