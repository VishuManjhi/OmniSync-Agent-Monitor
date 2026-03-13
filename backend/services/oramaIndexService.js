import Ticket from '../models/Ticket.js';
import { create, insertMultiple, search as oramaSearch } from '@orama/orama';

let oramaDb = null;
let isReady = false;

function normalizeText(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function toActionableSolution(raw = '') {
    const cleaned = normalizeText(raw);
    if (!cleaned) return '';

    const lower = cleaned.toLowerCase();
    if (lower.includes('seeded test ticket')) return '';
    if (/\bfor\s+a\d+\b/i.test(cleaned) && lower.includes('ticket')) return '';

    const sentence = cleaned
        .split(/(?<=[.!?])\s+/)
        .map((part) => normalizeText(part))
        .find((part) => part.length >= 18);

    const selected = sentence || cleaned;
    if (selected.length < 10) return '';
    return selected;
}

function collectCandidates(ticket) {
    const candidates = [];

    if (ticket?.resolution?.notes) {
        candidates.push(ticket.resolution.notes);
    }

    if (ticket?.description) {
        candidates.push(ticket.description);
    }

    const replies = Array.isArray(ticket?.emailMeta?.replies) ? ticket.emailMeta.replies : [];
    for (const reply of replies) {
        if (reply?.direction === 'outbound' && reply?.note) {
            candidates.push(reply.note);
        }
    }

    return candidates;
}

async function buildCorpus() {
    const resolvedTickets = await Ticket.find({ status: 'RESOLVED' })
        .select('ticketId issueType description resolution emailMeta resolvedAt updatedAt')
        .lean();

    const bucket = new Map();

    for (const ticket of resolvedTickets) {
        const candidates = collectCandidates(ticket);
        const lastUsedAt = Number(ticket?.resolvedAt || ticket?.updatedAt || 0);

        for (const raw of candidates) {
            const text = toActionableSolution(raw);
            if (!text || text.length < 12) continue;

            const key = text.toLowerCase();
            const existing = bucket.get(key);

            if (existing) {
                existing.usageCount += 1;
                existing.lastUsedAt = Math.max(existing.lastUsedAt, lastUsedAt);
            } else {
                bucket.set(key, {
                    id: key,
                    key,
                    text,
                    issueType: ticket?.issueType || 'other',
                    usageCount: 1,
                    lastUsedAt
                });
            }
        }
    }

    return Array.from(bucket.values());
}

async function createEmptyIndex() {
    return create({
        schema: {
            id: 'string',
            key: 'string',
            text: 'string',
            issueType: 'string',
            usageCount: 'number',
            lastUsedAt: 'number'
        }
    });
}

export async function rebuildOramaCorpus() {
    const docs = await buildCorpus();
    const db = await createEmptyIndex();

    if (docs.length > 0) {
        await insertMultiple(db, docs);
    }

    oramaDb = db;
    isReady = true;

    return {
        ok: true,
        indexed: docs.length
    };
}

export async function initOramaIndex() {
    if (isReady && oramaDb) {
        return { ok: true, indexed: null };
    }

    return rebuildOramaCorpus();
}

export async function searchOramaSolutions({ queryText, issueType, limit = 120 }) {
    const text = normalizeText(queryText);
    if (!text) return [];

    if (!isReady || !oramaDb) {
        await initOramaIndex();
    }

    const primary = await oramaSearch(oramaDb, {
        term: text,
        limit,
        ...(issueType ? { where: { issueType } } : {})
    });

    let hits = primary?.hits || [];

    if (!hits.length && issueType) {
        const fallback = await oramaSearch(oramaDb, {
            term: text,
            limit
        });
        hits = fallback?.hits || [];
    }

    return hits.map((hit) => ({
        key: hit?.document?.key,
        text: hit?.document?.text,
        score: Number(hit?.score || 0),
        usageCount: Number(hit?.document?.usageCount || 0),
        lastUsedAt: Number(hit?.document?.lastUsedAt || 0)
    })).filter((row) => row.key && row.text);
}
