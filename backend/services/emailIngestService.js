import crypto from 'crypto';
import Ticket from '../models/Ticket.js';
import { redisGet, redisSetNx } from './redisClient.js';
import { createOrUpsertTicket } from './ticketService.js';
import { triageEmailContent, extractReference } from './emailTriageService.js';
import { assignTicket } from './assignmentService.js';
import { postmarkSend } from './postmarkService.js';

const DEDUPE_TTL_MS = Number(process.env.EMAIL_DEDUPE_TTL_MS || 300000);

export function verifyPostmarkSignature(rawBody, signatureHeader) {
    const secret = process.env.POSTMARK_WEBHOOK_SECRET;
    if (!secret) {
        const err = new Error('POSTMARK_WEBHOOK_SECRET is missing');
        err.statusCode = 500;
        throw err;
    }

    const calculated = crypto
        .createHmac('sha256', secret)
        .update(rawBody || '', 'utf8')
        .digest('hex');

    return String(calculated).trim().toLowerCase() === String(signatureHeader || '').trim().toLowerCase();
}

function getInboundText(payload) {
    return payload.TextBody || payload.StrippedTextReply || payload.HtmlBody || '';
}

function pickEmail(payload) {
    return payload.FromEmail || payload.From || payload?.FromFull?.Email || '';
}

function pickName(payload) {
    return payload?.FromName || payload?.FromFull?.Name || '';
}

export async function ingestIncomingEmail(payload) {
    const providerMessageId = payload.MessageID || payload.MessageId || '';

    if (!providerMessageId) {
        const err = new Error('MESSAGE_ID_REQUIRED');
        err.statusCode = 400;
        throw err;
    }

    const dedupeKey = `email:dedupe:postmark:${providerMessageId}`;
    const cached = await redisGet(dedupeKey);
    if (cached) {
        return { ok: true, duplicate: true, ticketId: null };
    }

    const dedupeSet = await redisSetNx(dedupeKey, '1', DEDUPE_TTL_MS);
    if (!dedupeSet) {
        const secondRead = await redisGet(dedupeKey);
        if (secondRead) {
            return { ok: true, duplicate: true, ticketId: null };
        }
    }

    const subject = String(payload.Subject || '').trim();
    const textBody = String(getInboundText(payload) || '');
    const { issueType, triageLabel, triageBreakdown } = triageEmailContent({
        subject,
        textBody,
        htmlBody: payload.HtmlBody || ''
    });

    const customerEmail = pickEmail(payload);
    const customerName = pickName(payload);
    const reference = extractReference(`${subject}\n${textBody}`);
    const now = Date.now();

    const creation = await createOrUpsertTicket({
        agentId: 'UNASSIGNED',
        issueType,
        description: textBody || subject || 'Inbound email ticket',
        status: 'OPEN',
        issueDateTime: now,
        priority: 'MEDIUM',
        assignedBy: 'SYSTEM',
        createdBy: 'SYSTEM',
        emailMeta: {
            source: 'inbound_email',
            customerEmail,
            customerName,
            subject,
            providerMessageId,
            dedupeKey,
            triageLabel,
            triageBreakdown,
            sopMatched: !!reference,
            inboundAt: now,
            replies: [{
                direction: 'inbound',
                message: textBody,
                providerMessageId,
                at: now
            }]
        }
    });

    // REOPEN LOGIC: Check if this is a reply to a PENDING_CUSTOMER or RESOLVED ticket
    const existingTicket = await Ticket.findOne({
        'emailMeta.customerEmail': customerEmail,
        status: { $in: ['PENDING_CUSTOMER', 'RESOLVED'] }
    }).sort({ updatedAt: -1 });

    if (existingTicket) {
        await Ticket.updateOne(
            { _id: existingTicket._id },
            {
                $set: { status: 'REOPENED' },
                $push: {
                    'emailMeta.replies': {
                        direction: 'inbound',
                        message: textBody,
                        providerMessageId,
                        at: now
                    }
                }
            }
        );
        // We still let it return the new creation ticketId for dedupe safety or log it
        // but the existing one is now back in the queue.
    }

    let assigned = null;
    try {
        assigned = await assignTicket(creation.ticketId);
    } catch (err) {
        console.warn('[EMAIL_INGEST] Assignment failed', err.message);
    }

    if (reference && customerEmail) {
        const sopBody = `Hi ${customerName || 'there'},\n\nWe detected your reference ${reference} and started system handling. Our team will keep you updated.\n\nRegards,\nSupport Team`;
        try {
            await postmarkSend({
                to: customerEmail,
                subject: 'We received your issue report',
                textBody: sopBody
            });

            await Ticket.updateOne(
                { ticketId: creation.ticketId },
                {
                    $push: {
                        'emailMeta.replies': {
                            direction: 'outbound',
                            templateKey: 'SOP_ERR_ACK',
                            message: sopBody,
                            at: Date.now()
                        }
                    },
                    $set: {
                        'emailMeta.lastOutboundAt': Date.now(),
                        'emailMeta.sopMatched': true
                    }
                }
            );
        } catch (err) {
            console.warn('[EMAIL_INGEST] SOP auto-reply failed', err.message);
        }
    }

    return {
        ok: true,
        duplicate: false,
        ticketId: creation.ticketId,
        assignedAgentId: assigned?.agentId || null,
        triageLabel
    };
}
