import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { DeleteMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { connectDb } from '../db.js';
import AsyncJob from '../models/AsyncJob.js';
import Message from '../models/Message.js';
import { buildAgentReportMetrics, buildWorkbookBuffer, sendReportEmail } from '../services/reportService.js';
import { isSqsConfigured, sqsClient, sqsQueueUrl } from '../services/sqsClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads', 'reports');

const processJob = async ({ jobId, type, payload }) => {
    const job = await AsyncJob.findOne({ jobId });
    if (!job) return;

    job.status = 'PROCESSING';
    job.attempts = (job.attempts || 0) + 1;
    job.error = null;
    await job.save();

    if (type === 'EXCEL_EXPORT') {
        const report = await buildAgentReportMetrics(payload.agentId, payload.period || 'weekly');
        const buffer = await buildWorkbookBuffer(report);
        await fs.mkdir(uploadsDir, { recursive: true });

        const fileName = `${report.agent.agentId}-${report.period}-${Date.now()}.xlsx`;
        const absPath = path.join(uploadsDir, fileName);
        await fs.writeFile(absPath, Buffer.from(buffer));

        job.status = 'COMPLETED';
        job.result = {
            downloadUrl: `/uploads/reports/${fileName}`,
            fileName,
            agentId: report.agent.agentId,
            period: report.period
        };
        await job.save();
        return;
    }

    if (type === 'EMAIL_REPORT') {
        const report = await buildAgentReportMetrics(payload.agentId, payload.period || 'weekly');
        const buffer = await buildWorkbookBuffer(report);
        await sendReportEmail({ report, buffer });

        job.status = 'COMPLETED';
        job.result = {
            sentTo: report.agent.email,
            agentId: report.agent.agentId,
            period: report.period
        };
        await job.save();
        return;
    }

    if (type === 'NOTIFICATION') {
        const messageId = crypto.randomUUID();
        await Message.create({
            _id: messageId,
            senderId: payload.senderId || 'system',
            receiverId: payload.receiverId || undefined,
            content: payload.content,
            type: 'BROADCAST',
            timestamp: Date.now()
        });

        job.status = 'COMPLETED';
        job.result = { messageId };
        await job.save();
        return;
    }

    throw new Error('UNSUPPORTED_JOB_TYPE');
};

const runWorker = async () => {
    if (!isSqsConfigured()) {
        console.error('[SQS WORKER] SQS_QUEUE_URL not configured. Worker cannot start.');
        process.exit(1);
    }

    await connectDb();
    console.log('[SQS WORKER] Connected. Polling for jobs...');

    while (true) {
        try {
            const response = await sqsClient.send(new ReceiveMessageCommand({
                QueueUrl: sqsQueueUrl,
                MaxNumberOfMessages: 5,
                WaitTimeSeconds: 20,
                VisibilityTimeout: 60
            }));

            const messages = response.Messages || [];
            if (!messages.length) continue;

            for (const sqsMessage of messages) {
                try {
                    const body = JSON.parse(sqsMessage.Body || '{}');
                    await processJob(body);

                    await sqsClient.send(new DeleteMessageCommand({
                        QueueUrl: sqsQueueUrl,
                        ReceiptHandle: sqsMessage.ReceiptHandle
                    }));
                } catch (jobErr) {
                    const body = JSON.parse(sqsMessage.Body || '{}');
                    if (body?.jobId) {
                        await AsyncJob.updateOne(
                            { jobId: body.jobId },
                            { $set: { status: 'FAILED', error: jobErr instanceof Error ? jobErr.message : 'UNKNOWN_ERROR' } }
                        );
                    }
                    console.error('[SQS WORKER] Job failed:', jobErr);
                }
            }
        } catch (err) {
            console.error('[SQS WORKER] Poll loop error:', err);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

runWorker().catch((err) => {
    console.error('[SQS WORKER] Fatal error:', err);
    process.exit(1);
});
