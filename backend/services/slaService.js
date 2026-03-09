import Ticket from '../models/Ticket.js';
import { acquireLock, getOrSet, invalidatePattern, releaseLock } from './cacheService.js';
import { enqueueAsyncJob } from './queueService.js';

export async function getSlaBreachesData({ hours = 24, page = 1, limit = 10 }) {
    const safeHours = Math.max(parseInt(hours, 10) || 24, 1);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const breachThreshold = Date.now() - (safeHours * 60 * 60 * 1000);
    const query = {
        issueDateTime: { $lt: breachThreshold },
        status: { $nin: ['RESOLVED', 'REJECTED'] }
    };

    const cacheKey = `sla:hours=${safeHours}:page=${safePage}:limit=${safeLimit}`;

    return getOrSet(cacheKey, 30, async () => {
        const [total, breaches] = await Promise.all([
            Ticket.countDocuments(query),
            Ticket.find(query)
                .sort({ issueDateTime: 1 })
                .skip(skip)
                .limit(safeLimit)
                .lean()
        ]);

        return {
            hours: safeHours,
            threshold: breachThreshold,
            total,
            pages: Math.max(Math.ceil(total / safeLimit), 1),
            currentPage: safePage,
            breaches
        };
    });
}

export async function runSlaAutomationData({ hours = 24, requestedBy = 'system' }) {
    const safeHours = Math.max(parseInt(hours, 10) || 24, 1);
    const breachThreshold = Date.now() - (safeHours * 60 * 60 * 1000);

    const lockKey = 'sla:lock';
    const { ok: lockAcquired, token } = await acquireLock(lockKey, 5 * 60 * 1000);
    if (!lockAcquired) {
        const err = new Error('SLA_RUN_IN_PROGRESS');
        err.statusCode = 409;
        throw err;
    }

    try {
        const breachedTickets = await Ticket.find({
            issueDateTime: { $lt: breachThreshold },
            status: { $nin: ['RESOLVED', 'REJECTED'] }
        }).lean();

        if (!breachedTickets.length) {
            return { ok: true, escalated: 0, notified: false };
        }

        const ticketIds = breachedTickets.map(t => t.ticketId).filter(Boolean);

        await Ticket.updateMany(
            { ticketId: { $in: ticketIds } },
            { $set: { priority: 'URGENT' } }
        );

        try {
            await invalidatePattern('sla:*');
            await invalidatePattern('queue:*');
            await invalidatePattern('asyncjobs:*');
        } catch (err) {
            console.warn('[CACHE] Invalidation during SLA automation failed', err);
        }

        const notificationMessage = `SLA automation escalated ${ticketIds.length} breached ticket(s) older than ${safeHours}h.`;
        await enqueueAsyncJob('NOTIFICATION', {
            senderId: requestedBy,
            receiverId: null,
            content: notificationMessage
        });

        return {
            ok: true,
            escalated: ticketIds.length,
            notified: true,
            ticketIds
        };
    } finally {
        await releaseLock(lockKey, token);
    }
}
