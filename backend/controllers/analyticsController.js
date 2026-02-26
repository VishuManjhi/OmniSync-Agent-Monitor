import Ticket from '../models/Ticket.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import Agent from '../models/Agent.js';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';

const getRangeStart = (period) => {
    const now = Date.now();
    if (period === 'monthly') return now - (30 * 24 * 60 * 60 * 1000);
    return now - (7 * 24 * 60 * 60 * 1000);
};

const buildAgentReportMetrics = async (agentId, period = 'weekly') => {
    const since = getRangeStart(period);

    const [agent, ticketAgg, attendanceAgg, liveSession] = await Promise.all([
        Agent.findOne({ agentId: { $regex: new RegExp(`^${agentId}$`, 'i') } }).lean(),
        Ticket.aggregate([
            {
                $match: {
                    agentId: { $regex: new RegExp(`^${agentId}$`, 'i') },
                    issueDateTime: { $gte: since }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRaised: { $sum: 1 },
                    totalResolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } },
                    totalRejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } }
                }
            }
        ]),
        Session.aggregate([
            {
                $match: {
                    agentId: { $regex: new RegExp(`^${agentId}$`, 'i') },
                    clockInTime: { $gte: since }
                }
            },
            {
                $project: {
                    duration: {
                        $subtract: [
                            { $ifNull: ['$clockOutTime', Date.now()] },
                            '$clockInTime'
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalDurationMs: { $sum: '$duration' }
                }
            }
        ]),
        Session.findOne({ agentId, clockOutTime: null }).sort({ clockInTime: -1 }).lean()
    ]);

    const ahtAgg = await Ticket.aggregate([
        {
            $match: {
                agentId: { $regex: new RegExp(`^${agentId}$`, 'i') },
                status: 'RESOLVED',
                startedAt: { $gt: 0 },
                resolvedAt: { $gte: since }
            }
        },
        {
            $group: {
                _id: null,
                totalTime: { $sum: { $subtract: ['$resolvedAt', '$startedAt'] } },
                count: { $sum: 1 }
            }
        }
    ]);

    const totals = ticketAgg[0] || { totalRaised: 0, totalResolved: 0, totalRejected: 0 };
    const totalAttendanceHours = Number((((attendanceAgg[0]?.totalDurationMs || 0) / (1000 * 60 * 60)).toFixed(2)));
    const avgHandleTimeSeconds = ahtAgg[0] ? Math.floor(ahtAgg[0].totalTime / ahtAgg[0].count / 1000) : 0;
    const slaPercent = totals.totalRaised ? Number(((totals.totalResolved / totals.totalRaised) * 100).toFixed(2)) : 0;

    const status = !liveSession || liveSession.clockOutTime
        ? 'OFFLINE'
        : (liveSession.breaks?.some?.(b => !b.breakOut)
            ? 'ON_BREAK'
            : (liveSession.onCall ? 'ON_CALL' : 'ACTIVE'));

    return {
        period,
        from: since,
        to: Date.now(),
        agent: {
            agentId,
            name: agent?.name || agentId,
            email: agent?.email || null,
            status
        },
        metrics: {
            totalRaised: totals.totalRaised,
            totalResolved: totals.totalResolved,
            totalRejected: totals.totalRejected,
            attendanceHours: totalAttendanceHours,
            avgHandleTimeSeconds,
            slaPercent
        }
    };
};

const buildWorkbookBuffer = async (report) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Agent Report');

    sheet.columns = [
        { header: 'Metric', key: 'metric', width: 28 },
        { header: 'Value', key: 'value', width: 24 }
    ];

    sheet.addRow({ metric: 'Agent ID', value: report.agent.agentId });
    sheet.addRow({ metric: 'Agent Name', value: report.agent.name });
    sheet.addRow({ metric: 'Period', value: report.period.toUpperCase() });
    sheet.addRow({ metric: 'Live Status', value: report.agent.status });
    sheet.addRow({ metric: 'Total Tickets Raised', value: report.metrics.totalRaised });
    sheet.addRow({ metric: 'Total Tickets Resolved', value: report.metrics.totalResolved });
    sheet.addRow({ metric: 'Total Tickets Rejected', value: report.metrics.totalRejected });
    sheet.addRow({ metric: 'Attendance (Hours)', value: report.metrics.attendanceHours });
    sheet.addRow({ metric: 'AHT (Seconds)', value: report.metrics.avgHandleTimeSeconds });
    sheet.addRow({ metric: 'SLA %', value: report.metrics.slaPercent });
    sheet.addRow({ metric: 'Generated At', value: new Date().toISOString() });

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };

    return workbook.xlsx.writeBuffer();
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
        const { agentId } = req.params;
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        // 1. Ticket Analytics (Raised vs Resolved over last 7 days)
        const ticketStats = await Ticket.aggregate([
            {
                $match: {
                    agentId: { $regex: new RegExp(`^${agentId}$`, 'i') },
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
                    agentId: { $regex: new RegExp(`^${agentId}$`, 'i') },
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
        const currentSession = await Session.findOne({ agentId, clockOutTime: null })
            .sort({ clockInTime: -1 });

        const breakHistory = currentSession ? currentSession.breaks || [] : [];

        // 4. Overall Resolution Ratio (for Pie Chart)
        const overallStats = await Ticket.aggregate([
            { $match: { agentId: { $regex: new RegExp(`^${agentId}$`, 'i') } } },
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

        const report = await buildAgentReportMetrics(agentId, period);
        if (!report.agent.email) {
            return res.status(400).json({ error: 'AGENT_EMAIL_NOT_CONFIGURED' });
        }

        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.SMTP_FROM || user;

        if (!host || !port || !user || !pass || !from) {
            return res.status(500).json({ error: 'EMAIL_NOT_CONFIGURED' });
        }

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass }
        });

        const buffer = await buildWorkbookBuffer(report);

        await transporter.sendMail({
            from,
            to: report.agent.email,
            subject: `Performance Report (${period}) - ${report.agent.name}`,
            text: `Hi ${report.agent.name}, please find your ${period} performance report attached.`,
            attachments: [
                {
                    filename: `${report.agent.agentId}-${period}-report.xlsx`,
                    content: Buffer.from(buffer)
                }
            ]
        });

        res.json({ ok: true, sentTo: report.agent.email });
    } catch (err) {
        next(err);
    }
};
