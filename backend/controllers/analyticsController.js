import Ticket from '../models/Ticket.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import AsyncJob from '../models/AsyncJob.js';
import Agent from '../models/Agent.js';
import mongoose from 'mongoose';
import { enqueueAsyncJob } from '../services/queueService.js';
import { buildAgentReportMetrics, buildWorkbookBuffer } from '../services/reportService.js';

const resolveAgent = async (agentKey) => {
    if (mongoose.Types.ObjectId.isValid(agentKey)) {
        const byId = await Agent.findById(agentKey).lean();
        if (byId) return byId;
    }

    return Agent.findOne({ agentId: { $regex: new RegExp(`^${agentKey}$`, 'i') } }).lean();
};

/**
 * Get overall queue statistics (Global SLA, AHT, Counts)
 */
export const getQueueStats = async (req, res, next) => {
    try {
        const statsAggregation = await Ticket.aggregate([
            {
                $facet: {
                    // Overall counts by status
                    statusCounts: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    // Total ticket count
                    totalCount: [
                        { $count: 'total' }
                    ],
                    // AHT Calculation (Global)
                    ahtStats: [
                        {
                            $match: {
                                status: 'RESOLVED',
                                startedAt: { $gt: 0 },
                                resolvedAt: { $exists: true }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalTime: { $sum: { $subtract: ['$resolvedAt', '$startedAt'] } },
                                count: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ]);

        const results = statsAggregation[0];
        const statusMap = results.statusCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});

        const resolvedCount = statusMap['RESOLVED'] || 0;
        const rejectedCount = statusMap['REJECTED'] || 0;
        const approvalCount = statusMap['RESOLUTION_REQUESTED'] || 0;
        const openCount = statusMap['OPEN'] || 0;
        const assignedCount = statusMap['ASSIGNED'] || 0;
        const inProgressCount = statusMap['IN_PROGRESS'] || 0;

        const pendingCount = openCount + assignedCount + inProgressCount;
        const waitingCalls = pendingCount + approvalCount;
        const totalCount = results.totalCount[0]?.total || 0;

        // AHT Logic
        const ahtData = results.ahtStats[0];
        const avgHandleTime = ahtData ? Math.floor(ahtData.totalTime / ahtData.count / 1000) : 0;

        // Active Agents (still from Session model)
        const activeAgentsResult = await Session.distinct('agentId', { clockOutTime: null });
        const activeAgents = activeAgentsResult.length;

        const slaPercent = totalCount ? Math.round((resolvedCount / totalCount) * 100) : 0;

        res.json({
            timestamp: Date.now(),
            queueDepth: waitingCalls,
            waitingCalls,
            activeAgents,
            slaPercent,
            avgHandleTime,
            resolvedCount,
            rejectedCount,
            approvalCount,
            pendingCount,
            totalCount
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get broadcast history
 */
export const getBroadcasts = async (req, res, next) => {
    try {
        const broadcasts = await Message.find({ type: 'BROADCAST' })
            .sort({ timestamp: -1 })
            .limit(10);
        res.json(broadcasts);
    } catch (err) {
        next(err);
    }
};
/**
 * Get agent-specific performance analytics (Tickets raised/resolved, online time, break history)
 */
export const getAgentAnalytics = async (req, res, next) => {
    try {
        const { agentId: agentKey } = req.params;
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const agent = await resolveAgent(agentKey);

        if (!agent) {
            return res.status(404).json({ error: 'AGENT_NOT_FOUND' });
        }

        const canonicalAgentId = agent.agentId;

        // 1. Ticket Analytics (Raised vs Resolved over last 7 days)
        const ticketStats = await Ticket.aggregate([
            {
                $match: {
                    agentId: canonicalAgentId,
                    issueDateTime: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        day: { $dateToString: { format: "%Y-%m-%d", date: { $add: [new Date(0), "$issueDateTime"] } } }
                    },
                    raised: { $sum: 1 },
                    resolved: {
                        $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] }
                    }
                }
            },
            { $sort: { "_id.day": 1 } }
        ]);

        // 2. Session Analytics (Online time over last 7 days)
        const sessionStats = await Session.aggregate([
            {
                $match: {
                    agentId: canonicalAgentId,
                    clockInTime: { $gte: sevenDaysAgo }
                }
            },
            {
                $project: {
                    day: { $dateToString: { format: "%Y-%m-%d", date: { $add: [new Date(0), "$clockInTime"] } } },
                    duration: {
                        $subtract: [
                            { $ifNull: ["$clockOutTime", Date.now()] },
                            "$clockInTime"
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$day",
                    totalOnlineTime: { $sum: "$duration" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // 3. Current Session Break History
        const currentSession = await Session.findOne({ agentId: canonicalAgentId, clockOutTime: null })
            .sort({ clockInTime: -1 });

        const breakHistory = currentSession ? currentSession.breaks || [] : [];

        // 4. Overall Resolution Ratio (for Pie Chart)
        const overallStats = await Ticket.aggregate([
            { $match: { agentId: canonicalAgentId } },
            {
                $facet: {
                    ratios: [
                        {
                            $group: {
                                _id: null,
                                totalRaised: { $sum: 1 },
                                totalResolved: {
                                    $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] }
                                },
                                totalRejected: {
                                    $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] }
                                }
                            }
                        }
                    ],
                    aht: [
                        {
                            $match: {
                                status: 'RESOLVED',
                                startedAt: { $gt: 0 },
                                resolvedAt: { $exists: true }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalTime: { $sum: { $subtract: ['$resolvedAt', '$startedAt'] } },
                                count: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ]);

        const stats = overallStats[0].ratios[0] || { totalRaised: 0, totalResolved: 0, totalRejected: 0 };
        const ahtData = overallStats[0].aht[0];
        const avgHandleTime = ahtData ? Math.floor(ahtData.totalTime / ahtData.count / 1000) : 0;

        res.json({
            ticketHistory: ticketStats.map(s => ({
                day: s._id.day,
                raised: s.raised,
                resolved: s.resolved
            })),
            sessionHistory: sessionStats.map(s => ({
                day: s._id,
                onlineTimeHours: Number((s.totalOnlineTime / (1000 * 60 * 60)).toFixed(2))
            })),
            breakHistory,
            overallRatio: stats,
            avgHandleTime
        });
    } catch (err) {
        next(err);
    }
};

export const getAgentReport = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const period = req.query.period === 'monthly' ? 'monthly' : 'weekly';
        const report = await buildAgentReportMetrics(agentId, period);
        res.json(report);
    } catch (err) {
        next(err);
    }
};

export const exportAgentReport = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const period = req.query.period === 'monthly' ? 'monthly' : 'weekly';
        const report = await buildAgentReportMetrics(agentId, period);
        const buffer = await buildWorkbookBuffer(report);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${agentId}-${period}-report.xlsx"`);
        res.send(Buffer.from(buffer));
    } catch (err) {
        next(err);
    }
};

export const emailAgentReport = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const period = req.body?.period === 'monthly' ? 'monthly' : 'weekly';

        const job = await enqueueAsyncJob('EMAIL_REPORT', {
            agentId,
            period,
            requestedBy: req.user?.agentId || req.user?.id || 'system'
        });

        res.status(202).json({ ok: true, ...job });
    } catch (err) {
        next(err);
    }
};

export const enqueueAgentReportExport = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const period = req.body?.period === 'monthly' ? 'monthly' : 'weekly';

        const job = await enqueueAsyncJob('EXCEL_EXPORT', {
            agentId,
            period,
            requestedBy: req.user?.agentId || req.user?.id || 'system'
        });

        res.status(202).json({ ok: true, ...job });
    } catch (err) {
        next(err);
    }
};

export const enqueueNotification = async (req, res, next) => {
    try {
        const content = String(req.body?.content || '').trim();
        const receiverId = req.body?.receiverId ? String(req.body.receiverId) : null;

        if (!content) {
            return res.status(400).json({ error: 'CONTENT_REQUIRED' });
        }

        const job = await enqueueAsyncJob('NOTIFICATION', {
            senderId: req.user?.agentId || req.user?.id || 'system',
            receiverId,
            content
        });

        res.status(202).json({ ok: true, ...job });
    } catch (err) {
        next(err);
    }
};

export const getAsyncJobStatus = async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const job = await AsyncJob.findOne({ jobId }).lean();

        if (!job) {
            return res.status(404).json({ error: 'JOB_NOT_FOUND' });
        }

        res.json({
            jobId: job.jobId,
            type: job.type,
            status: job.status,
            result: job.result,
            error: job.error,
            attempts: job.attempts,
            updatedAt: job.updatedAt
        });
    } catch (err) {
        next(err);
    }
};

export const listAsyncJobs = async (req, res, next) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
        const skip = (page - 1) * limit;
        const status = req.query.status ? String(req.query.status) : null;
        const type = req.query.type ? String(req.query.type) : null;

        const query = {};
        if (status) query.status = status;
        if (type) query.type = type;

        const [total, jobs] = await Promise.all([
            AsyncJob.countDocuments(query),
            AsyncJob.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        res.json({
            total,
            pages: Math.max(Math.ceil(total / limit), 1),
            currentPage: page,
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
        });
    } catch (err) {
        next(err);
    }
};

export const getSlaBreaches = async (req, res, next) => {
    try {
        const hours = Math.max(parseInt(req.query.hours, 10) || 24, 1);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
        const skip = (page - 1) * limit;
        const breachThreshold = Date.now() - (hours * 60 * 60 * 1000);
        const query = {
            issueDateTime: { $lt: breachThreshold },
            status: { $nin: ['RESOLVED', 'REJECTED'] }
        };

        const [total, breaches] = await Promise.all([
            Ticket.countDocuments(query),
            Ticket.find(query)
                .sort({ issueDateTime: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        res.json({
            hours,
            threshold: breachThreshold,
            total,
            pages: Math.max(Math.ceil(total / limit), 1),
            currentPage: page,
            breaches
        });
    } catch (err) {
        next(err);
    }
};

export const runSlaAutomation = async (req, res, next) => {
    try {
        const hours = Math.max(parseInt(req.body?.hours, 10) || 24, 1);
        const breachThreshold = Date.now() - (hours * 60 * 60 * 1000);

        const breachedTickets = await Ticket.find({
            issueDateTime: { $lt: breachThreshold },
            status: { $nin: ['RESOLVED', 'REJECTED'] }
        }).lean();

        if (!breachedTickets.length) {
            return res.json({ ok: true, escalated: 0, notified: false });
        }

        const ticketIds = breachedTickets.map(t => t.ticketId);

        await Ticket.updateMany(
            { ticketId: { $in: ticketIds } },
            { $set: { priority: 'URGENT' } }
        );

        const notificationMessage = `SLA automation escalated ${ticketIds.length} breached ticket(s) older than ${hours}h.`;
        await enqueueAsyncJob('NOTIFICATION', {
            senderId: req.user?.agentId || req.user?.id || 'system',
            receiverId: null,
            content: notificationMessage
        });

        res.json({
            ok: true,
            escalated: ticketIds.length,
            notified: true,
            ticketIds
        });
    } catch (err) {
        next(err);
    }
};
