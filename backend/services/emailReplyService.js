import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import { postmarkSend, postmarkSendWithTemplate } from './postmarkService.js';
import { setTicketPendingCustomer } from './ticketService.js';
import { searchOramaSolutions } from './oramaIndexService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesPath = path.join(__dirname, '..', 'config', 'replyTemplates.json');

let templates = {};
const USE_ORAMA_TOP3 = String(process.env.USE_ORAMA_TOP3 || 'true').toLowerCase() !== 'false';

try {
    templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
} catch (err) {
    console.warn('[EMAIL_REPLY] Could not load templates', err.message);
}

function renderTemplate(template = '', vars = {}) {
    let content = String(template || '');
    for (const [key, value] of Object.entries(vars)) {
        content = content.replaceAll(`{{${key}}}`, String(value ?? ''));
    }
    return content;
}

export async function sendTicketReply({ ticketId, templateKey, note }) {
    const query = mongoose.Types.ObjectId.isValid(ticketId)
        ? { $or: [{ _id: ticketId }, { ticketId }] }
        : { ticketId };

    const ticket = await Ticket.findOne(query).lean();
    if (!ticket) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    const customerEmail = ticket.emailMeta?.customerEmail;
    if (!customerEmail) {
        const err = new Error('TICKET_HAS_NO_CUSTOMER_EMAIL');
        err.statusCode = 400;
        throw err;
    }

    const selectedTemplate = templates[templateKey];
    if (!selectedTemplate) {
        const err = new Error('UNKNOWN_TEMPLATE_KEY');
        err.statusCode = 400;
        throw err;
    }

    const vars = {
        name: ticket.emailMeta?.customerName || 'there',
        displayId: ticket.displayId || ticket.ticketId,
        note: note || 'We are processing your request.'
    };

    const subject = renderTemplate(selectedTemplate.subject, vars);
    const textBody = renderTemplate(selectedTemplate.body, vars);

    const aliasEnvKey = `POSTMARK_TEMPLATE_ALIAS_${templateKey}`;
    const templateAlias = process.env[aliasEnvKey] || templateKey;
    const forceLocalTemplate = String(process.env.POSTMARK_USE_SERVER_TEMPLATES || '').toLowerCase() === 'false';

    let sendResult;
    if (!forceLocalTemplate) {
        try {
            sendResult = await postmarkSendWithTemplate({
                to: customerEmail,
                templateAlias,
                templateModel: {
                    name: vars.name,
                    displayId: vars.displayId,
                    note: vars.note,
                    reference: note || ''
                }
            });
        } catch (err) {
            console.warn('[EMAIL_REPLY] Template send failed, falling back to local render', err.message);
            sendResult = await postmarkSend({
                to: customerEmail,
                subject,
                textBody
            });
        }
    } else {
        sendResult = await postmarkSend({
            to: customerEmail,
            subject,
            textBody
        });
    }

    await setTicketPendingCustomer(ticketId, {
        reply: {
            direction: 'outbound',
            templateKey,
            note,
            message: textBody,
            providerMessageId: sendResult?.MessageID,
            at: Date.now()
        }
    });

    return {
        ok: true,
        messageId: sendResult?.MessageID,
        to: customerEmail
    };
}

function normalizeSolutionText(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function toActionableSolution(raw = '') {
    const cleaned = normalizeSolutionText(raw);
    if (!cleaned) return '';

    const lower = cleaned.toLowerCase();
    if (lower.includes('seeded test ticket')) return '';
    if (/\bfor\s+a\d+\b/i.test(cleaned) && lower.includes('ticket')) return '';

    const sentence = cleaned
        .split(/(?<=[.!?])\s+/)
        .map((part) => normalizeSolutionText(part))
        .find((part) => part.length >= 18);

    const selected = sentence || cleaned;
    if (selected.length < 10) return '';
    return selected;
}

function getBootstrapSolutions(issueType = 'other') {
    const map = {
        FOH: [
            'Restart POS app and sign in again, then retry billing.',
            'Check printer power/cable and run a local print test.',
            'Sync menu/config from admin and retry order placement.'
        ],
        BOH: [
            'Restart KDS/tablet and verify store network connectivity.',
            'Validate kitchen station routing and printer mapping.',
            'Clear pending queue on device and resend the order.'
        ],
        KIOSK: [
            'Power-cycle kiosk and relaunch app in kiosk mode.',
            'Verify payment terminal connectivity and retry transaction.',
            'Sync kiosk configuration and confirm device date/time.'
        ],
        other: [
            'Capture exact error text and timestamp from the user.',
            'Restart affected app/device and retry the same workflow.',
            'Verify network and account mapping from admin panel.'
        ]
    };

    return map[issueType] || map.other;
}

function padSolutions(baseSolutions = [], issueType = 'other', limit = 3) {
    const target = Math.max(Number(limit) || 3, 1);
    const dedupe = new Set(baseSolutions.map((item) => String(item.text || '').toLowerCase()));
    const result = [...baseSolutions];

    for (const text of getBootstrapSolutions(issueType)) {
        const key = String(text).toLowerCase();
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        result.push({
            text,
            usageCount: 0,
            lastUsedAt: null,
            source: 'bootstrap'
        });
        if (result.length >= target) break;
    }

    return result.slice(0, target).map((entry, index) => ({
        rank: index + 1,
        text: entry.text,
        usageCount: entry.usageCount ?? 0,
        lastUsedAt: entry.lastUsedAt ?? null,
        source: entry.source || 'historical'
    }));
}

async function aggregateHistoricalCandidates(match, maxRows = 400) {
    const candidateKeys = Array.isArray(match.__candidateKeys) ? match.__candidateKeys : [];
    const safeMatch = { ...match };
    delete safeMatch.__candidateKeys;

    const pipeline = [
        { $match: safeMatch },
        {
            $project: {
                lastUsedAt: { $ifNull: ['$resolvedAt', '$updatedAt'] },
                candidates: {
                    $concatArrays: [
                        {
                            $cond: [
                                { $gt: [{ $strLenCP: { $ifNull: ['$resolution.notes', ''] } }, 0] },
                                ['$resolution.notes'],
                                []
                            ]
                        },
                        {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ['$resolution.status', 'REJECTED'] },
                                        { $gt: [{ $strLenCP: { $ifNull: ['$description', ''] } }, 0] }
                                    ]
                                },
                                ['$description'],
                                []
                            ]
                        },
                        {
                            $map: {
                                input: {
                                    $filter: {
                                        input: { $ifNull: ['$emailMeta.replies', []] },
                                        as: 'reply',
                                        cond: {
                                            $and: [
                                                { $eq: ['$$reply.direction', 'outbound'] },
                                                { $gt: [{ $strLenCP: { $ifNull: ['$$reply.note', ''] } }, 0] }
                                            ]
                                        }
                                    }
                                },
                                as: 'reply',
                                in: '$$reply.note'
                            }
                        }
                    ]
                }
            }
        },
        { $unwind: '$candidates' },
        {
            $project: {
                candidate: { $trim: { input: '$candidates' } },
                candidateKey: { $toLower: { $trim: { input: '$candidates' } } },
                lastUsedAt: 1
            }
        },
        {
            $match: {
                candidate: { $exists: true, $ne: '' }
            }
        },
        ...(candidateKeys.length > 0 ? [{ $match: { candidateKey: { $in: candidateKeys } } }] : []),
        {
            $group: {
                _id: '$candidateKey',
                text: { $first: '$candidate' },
                usageCount: { $sum: 1 },
                lastUsedAt: { $max: '$lastUsedAt' }
            }
        },
        { $sort: { usageCount: -1, lastUsedAt: -1 } },
        { $limit: maxRows }
    ];

    return Ticket.aggregate(pipeline);
}

export async function getTopHistoricalSolutions({ ticketId, limit = 3 }) {
    const query = mongoose.Types.ObjectId.isValid(ticketId)
        ? { $or: [{ _id: ticketId }, { ticketId }] }
        : { ticketId };

    const current = await Ticket.findOne(query).lean();
    if (!current) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    const scopedMatch = {
        issueType: current.issueType,
        status: 'RESOLVED',
        ticketId: { $ne: current.ticketId }
    };

    const queryText = [
        current.issueType || '',
        current.description || '',
        current?.emailMeta?.subject || ''
    ].filter(Boolean).join(' ').trim();

    let oramaCandidates = [];
    if (USE_ORAMA_TOP3 && queryText) {
        try {
            oramaCandidates = await searchOramaSolutions({
                queryText,
                issueType: current.issueType,
                limit: 120
            });
        } catch (err) {
            console.warn('[EMAIL_REPLY] Orama search failed, falling back to mongo-only ranking', err.message);
            oramaCandidates = [];
        }
    }

    const candidateKeys = oramaCandidates.map((item) => item.key).filter(Boolean);
    const oramaScoreByKey = new Map(oramaCandidates.map((item) => [item.key, Number(item.score || 0)]));

    let aggregateRows = await aggregateHistoricalCandidates({
        ...scopedMatch,
        ...(candidateKeys.length > 0 ? { __candidateKeys: candidateKeys } : {})
    });

    if (!aggregateRows.length && candidateKeys.length > 0) {
        aggregateRows = await aggregateHistoricalCandidates(scopedMatch);
    }

    if (!aggregateRows.length) {
        aggregateRows = await aggregateHistoricalCandidates({
            status: 'RESOLVED',
            ticketId: { $ne: current.ticketId }
        });
    }

    const bucket = new Map();

    for (const row of aggregateRows) {
        const cleaned = toActionableSolution(row?.text || '');
        if (!cleaned || cleaned.length < 12) continue;

        const key = cleaned.toLowerCase();
        const existing = bucket.get(key);
        const usageCount = Number(row?.usageCount || 0);
        const lastUsed = Number(row?.lastUsedAt || 0);
        const oramaScore = Number(oramaScoreByKey.get(key) || 0);

        if (existing) {
            existing.count += usageCount;
            existing.lastUsed = Math.max(existing.lastUsed, lastUsed);
            existing.oramaScore = Math.max(existing.oramaScore, oramaScore);
        } else {
            bucket.set(key, {
                text: cleaned,
                count: usageCount,
                lastUsed,
                oramaScore,
                source: 'historical'
            });
        }
    }

    const rankedRows = Array.from(bucket.values());
    const maxCount = rankedRows.reduce((max, row) => Math.max(max, row.count || 0), 1);
    const maxLastUsed = rankedRows.reduce((max, row) => Math.max(max, row.lastUsed || 0), 1);
    const maxOrama = rankedRows.reduce((max, row) => Math.max(max, row.oramaScore || 0), 1);

    for (const row of rankedRows) {
        const usageNorm = maxCount > 0 ? row.count / maxCount : 0;
        const recencyNorm = maxLastUsed > 0 ? row.lastUsed / maxLastUsed : 0;
        const oramaNorm = maxOrama > 0 ? row.oramaScore / maxOrama : 0;
        row.finalScore = (oramaNorm * 0.6) + (usageNorm * 0.3) + (recencyNorm * 0.1);
        if (oramaNorm > 0) {
            row.source = 'orama';
        }
    }

    const solutions = padSolutions(rankedRows
        .sort((a, b) => {
            if ((b.finalScore || 0) !== (a.finalScore || 0)) {
                return (b.finalScore || 0) - (a.finalScore || 0);
            }
            if (b.count !== a.count) return b.count - a.count;
            return b.lastUsed - a.lastUsed;
        })
        .slice(0, Math.max(Number(limit) || 3, 1))
        .map((entry) => ({
            text: entry.text,
            usageCount: entry.count,
            lastUsedAt: entry.lastUsed || null,
            source: entry.source || 'historical'
        })), current.issueType, limit);

    if (!solutions.length) {
        return {
            ok: true,
            ticketId: current.ticketId,
            issueType: current.issueType,
            solutions: padSolutions([], current.issueType, limit)
        };
    }

    return {
        ok: true,
        ticketId: current.ticketId,
        issueType: current.issueType,
        solutions
    };
}

export async function applyHistoricalSolution({ ticketId, solutionText, actorId = 'SYSTEM' }) {
    const query = mongoose.Types.ObjectId.isValid(ticketId)
        ? { $or: [{ _id: ticketId }, { ticketId }] }
        : { ticketId };

    const ticket = await Ticket.findOne(query).lean();
    if (!ticket) {
        const err = new Error('NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    const customerEmail = ticket?.emailMeta?.customerEmail;
    if (!customerEmail) {
        const err = new Error('TICKET_HAS_NO_CUSTOMER_EMAIL');
        err.statusCode = 400;
        throw err;
    }

    const cleanedSolution = toActionableSolution(solutionText);
    if (!cleanedSolution || cleanedSolution.length < 12) {
        const err = new Error('INVALID_SOLUTION_TEXT');
        err.statusCode = 400;
        throw err;
    }

    const customerName = ticket?.emailMeta?.customerName || 'there';
    const subject = `Update on your ticket ${ticket.displayId || ticket.ticketId}`;
    const textBody = `Hi ${customerName},\n\nBased on similar resolved cases, please try this:\n${cleanedSolution}\n\nReply to this email if the issue persists.\n\nRegards,\nSupport Team`;

    let sendResult;
    try {
        sendResult = await postmarkSendWithTemplate({
            to: customerEmail,
            templateAlias: process.env.POSTMARK_TEMPLATE_ALIAS_HISTORICAL_TOP_SOLUTION || 'HISTORICAL_TOP_SOLUTION',
            templateModel: {
                name: customerName,
                displayId: ticket.displayId || ticket.ticketId,
                note: cleanedSolution,
                solution: cleanedSolution
            }
        });
    } catch (err) {
        console.warn('[EMAIL_REPLY] Historical template send failed, falling back to direct body', err.message);
        sendResult = await postmarkSend({
            to: customerEmail,
            subject,
            textBody
        });
    }

    await setTicketPendingCustomer(ticketId, {
        reply: {
            direction: 'outbound',
            templateKey: 'HISTORICAL_TOP_SOLUTION',
            note: cleanedSolution,
            message: textBody,
            providerMessageId: sendResult?.MessageID,
            at: Date.now(),
            actorId
        }
    });

    return {
        ok: true,
        messageId: sendResult?.MessageID,
        to: customerEmail,
        ticketId: ticket.ticketId
    };
}
