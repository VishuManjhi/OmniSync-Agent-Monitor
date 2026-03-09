import AsyncJob from '../models/AsyncJob.js';
import { enqueueAsyncJob } from './queueService.js';
import { getOrSet } from './cacheService.js';

export async function getAsyncJobStatusById(jobId) {
    const job = await AsyncJob.findOne({ jobId }).lean();
    if (!job) {
        const err = new Error('JOB_NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    return {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        result: job.result,
        error: job.error,
        attempts: job.attempts,
        updatedAt: job.updatedAt
    };
}

export async function listAsyncJobsData({ page = 1, limit = 25, status = null, type = null }) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const query = {};
    if (status) query.status = String(status);
    if (type) query.type = String(type);

    const cacheKey = `asyncjobs:page=${safePage}:limit=${safeLimit}:type=${type || ''}:status=${status || ''}`;

    return getOrSet(cacheKey, 15, async () => {
        const [total, jobs] = await Promise.all([
            AsyncJob.countDocuments(query),
            AsyncJob.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean()
        ]);

        return {
            total,
            pages: Math.max(Math.ceil(total / safeLimit), 1),
            currentPage: safePage,
            items: jobs.map(job => ({
                jobId: job.jobId,
                type: job.type,
                status: job.status,
                result: job.result,
                error: job.error,
                attempts: job.attempts,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt
            }))
        };
    });
}

export async function enqueueEmailReportJob({ agentId, period, requestedBy }) {
    return enqueueAsyncJob('EMAIL_REPORT', {
        agentId,
        period,
        requestedBy
    });
}

export async function enqueueExportReportJob({ agentId, period, requestedBy }) {
    return enqueueAsyncJob('EXCEL_EXPORT', {
        agentId,
        period,
        requestedBy
    });
}

export async function enqueueNotificationJob({ senderId, receiverId, content }) {
    if (!String(content || '').trim()) {
        const err = new Error('CONTENT_REQUIRED');
        err.statusCode = 400;
        throw err;
    }

    return enqueueAsyncJob('NOTIFICATION', {
        senderId,
        receiverId,
        content: String(content).trim()
    });
}
