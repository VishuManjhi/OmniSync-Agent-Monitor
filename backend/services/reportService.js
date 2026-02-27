import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';
import Agent from '../models/Agent.js';
import Ticket from '../models/Ticket.js';
import Session from '../models/Session.js';

const getRangeStart = (period) => {
    const now = Date.now();
    if (period === 'monthly') return now - (30 * 24 * 60 * 60 * 1000);
    return now - (7 * 24 * 60 * 60 * 1000);
};

const resolveAgent = async (agentKey) => {
    if (mongoose.Types.ObjectId.isValid(agentKey)) {
        const byId = await Agent.findById(agentKey).lean();
        if (byId) return byId;
    }

    return Agent.findOne({ agentId: { $regex: new RegExp(`^${agentKey}$`, 'i') } }).lean();
};

export const buildAgentReportMetrics = async (agentId, period = 'weekly') => {
    const since = getRangeStart(period);
    const agent = await resolveAgent(agentId);

    if (!agent) {
        const err = new Error('AGENT_NOT_FOUND');
        err.statusCode = 404;
        throw err;
    }

    const canonicalAgentId = agent.agentId;

    const [ticketAgg, attendanceAgg, liveSession] = await Promise.all([
        Ticket.aggregate([
            { $match: { agentId: canonicalAgentId, issueDateTime: { $gte: since } } },
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
            { $match: { agentId: canonicalAgentId, clockInTime: { $gte: since } } },
            {
                $project: {
                    duration: {
                        $subtract: [{ $ifNull: ['$clockOutTime', Date.now()] }, '$clockInTime']
                    }
                }
            },
            { $group: { _id: null, totalDurationMs: { $sum: '$duration' } } }
        ]),
        Session.findOne({ agentId: canonicalAgentId, clockOutTime: null }).sort({ clockInTime: -1 }).lean()
    ]);

    const ahtAgg = await Ticket.aggregate([
        {
            $match: {
                agentId: canonicalAgentId,
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
            agentId: canonicalAgentId,
            name: agent?.name || canonicalAgentId,
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

export const buildWorkbookBuffer = async (report) => {
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

    sheet.getRow(1).font = { bold: true };

    return workbook.xlsx.writeBuffer();
};

export const sendReportEmail = async ({ report, buffer }) => {
    if (!report.agent.email) {
        throw new Error('AGENT_EMAIL_NOT_CONFIGURED');
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!host || !port || !user || !pass || !from) {
        throw new Error('EMAIL_NOT_CONFIGURED');
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    });

    await transporter.sendMail({
        from,
        to: report.agent.email,
        subject: `Performance Report (${report.period}) - ${report.agent.name}`,
        text: `Hi ${report.agent.name}, please find your ${report.period} performance report attached.`,
        attachments: [
            {
                filename: `${report.agent.agentId}-${report.period}-report.xlsx`,
                content: Buffer.from(buffer)
            }
        ]
    });
};
