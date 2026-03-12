import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '..', 'config', 'patternLibrary.json');

let patternLibrary = { FOH: [], BOH: [], KIOSK: [] };

try {
    patternLibrary = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    console.warn('[EMAIL_TRIAGE] Could not load pattern library, using defaults', err.message);
}

function normalizeRule(rule) {
    if (!rule) return null;
    if (typeof rule === 'string') {
        return { term: rule, weight: 1 };
    }

    if (typeof rule === 'object' && typeof rule.term === 'string') {
        const parsedWeight = Number(rule.weight);
        return {
            term: rule.term,
            weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1
        };
    }

    return null;
}

export function triageEmailContent({ subject = '', textBody = '', htmlBody = '' }) {
    const normalized = `${subject}\n${textBody}\n${htmlBody}`.toLowerCase();

    const scores = {
        FOH: 0,
        BOH: 0,
        KIOSK: 0
    };

    const matchedTerms = {
        FOH: [],
        BOH: [],
        KIOSK: []
    };

    for (const [label, rules] of Object.entries(patternLibrary)) {
        for (const rule of rules || []) {
            const normalizedRule = normalizeRule(rule);
            if (!normalizedRule || !normalizedRule.term) continue;

            if (normalized.includes(String(normalizedRule.term).toLowerCase())) {
                scores[label] = (scores[label] || 0) + normalizedRule.weight;
                matchedTerms[label].push({
                    term: normalizedRule.term,
                    weight: normalizedRule.weight
                });
            }
        }
    }

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [winner, score] = ranked[0] || ['other', 0];

    const triageBreakdown = {
        scores,
        ranked: ranked.map(([label, value]) => ({ label, score: value })),
        matchedTerms
    };

    if (!score) {
        return { issueType: 'other', triageLabel: 'other', triageBreakdown };
    }

    return { issueType: winner, triageLabel: winner, triageBreakdown };
}

export function extractReference(text = '') {
    const match = String(text || '').match(/ERR-\d+/i);
    return match ? match[0].toUpperCase() : null;
}
