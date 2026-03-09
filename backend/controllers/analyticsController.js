import Ticket from '../models/Ticket.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import Agent from '../models/Agent.js';
import mongoose from 'mongoose';
import { getAsyncJobStatusById, listAsyncJobsData, enqueueEmailReportJob, enqueueExportReportJob, enqueueNotificationJob } from '../services/jobService.js';
import { getSlaBreachesData, runSlaAutomationData } from '../services/slaService.js';
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

        const job = await enqueueEmailReportJob({
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

        const job = await enqueueExportReportJob({
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
        const job = await enqueueNotificationJob({
            senderId: req.user?.agentId || req.user?.id || 'system',
            receiverId: req.body?.receiverId ? String(req.body.receiverId) : null,
            content: req.body?.content
        });

        res.status(202).json({ ok: true, ...job });
    } catch (err) {
        if (err?.statusCode === 400 && err?.message === 'CONTENT_REQUIRED') {
            return res.status(400).json({ error: 'CONTENT_REQUIRED' });
        }
        next(err);
    }
};

export const getAsyncJobStatus = async (req, res, next) => {
    try {
        const payload = await getAsyncJobStatusById(req.params.jobId);
        res.json(payload);
    } catch (err) {
        if (err?.statusCode === 404 && err?.message === 'JOB_NOT_FOUND') {
            return res.status(404).json({ error: 'JOB_NOT_FOUND' });
        }
        next(err);
    }
};

export const listAsyncJobs = async (req, res, next) => {
    try {
        const payload = await listAsyncJobsData({
            page: req.query.page,
            limit: req.query.limit,
            status: req.query.status,
            type: req.query.type
        });
        res.json(payload);
    } catch (err) {
        next(err);
    }
};

export const getSlaBreaches = async (req, res, next) => {
    try {
        const payload = await getSlaBreachesData({
            hours: req.query.hours,
            page: req.query.page,
            limit: req.query.limit
        });
        res.json(payload);
    } catch (err) {
        next(err);
    }
};

export const runSlaAutomation = async (req, res, next) => {
    try {
        const payload = await runSlaAutomationData({
            hours: req.body?.hours,
            requestedBy: req.user?.agentId || req.user?.id || 'system'
        });
        return res.json(payload);
    } catch (err) {
        if (err?.statusCode === 409 && err?.message === 'SLA_RUN_IN_PROGRESS') {
            return res.status(409).json({ error: 'SLA_RUN_IN_PROGRESS' });
        }
        next(err);
    }
};
