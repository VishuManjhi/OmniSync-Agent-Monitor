import { SQSClient } from '@aws-sdk/client-sqs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export const sqsQueueUrl = process.env.SQS_QUEUE_URL || '';

const deriveRegionFromQueueUrl = (queueUrl) => {
    if (!queueUrl) return null;
    try {
        const host = new URL(queueUrl).hostname; // sqs.<region>.amazonaws.com
        const match = host.match(/^sqs\.([a-z0-9-]+)\.amazonaws\.com$/i);
        return match?.[1] || null;
    } catch {
        return null;
    }
};

const queueRegion = deriveRegionFromQueueUrl(sqsQueueUrl);
const region = queueRegion || process.env.AWS_REGION || 'ap-south-1';

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

export const sqsClient = new SQSClient({
    region,
    ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        }
        : {})
});

export const isSqsConfigured = () => Boolean(sqsQueueUrl);
