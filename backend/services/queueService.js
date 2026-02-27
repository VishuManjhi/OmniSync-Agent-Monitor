import crypto from 'crypto';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import AsyncJob from '../models/AsyncJob.js';
import { isSqsConfigured, sqsClient, sqsQueueUrl } from './sqsClient.js';

export const enqueueAsyncJob = async (type, payload) => {
    if (!isSqsConfigured()) {
        const err = new Error('SQS_NOT_CONFIGURED');
        err.code = 'SQS_NOT_CONFIGURED';
        err.status = 500;
        err.statusCode = 500;
        throw err;
    }

    const jobId = crypto.randomUUID();

    await AsyncJob.create({
        jobId,
        type,
        payload,
        status: 'QUEUED'
    });

    await sqsClient.send(new SendMessageCommand({
        QueueUrl: sqsQueueUrl,
        MessageBody: JSON.stringify({ jobId, type, payload })
    }));

    return { jobId, status: 'QUEUED' };
};
