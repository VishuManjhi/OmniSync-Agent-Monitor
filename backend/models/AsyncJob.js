import mongoose from 'mongoose';

const asyncJobSchema = new mongoose.Schema({
    jobId: { type: String, required: true, unique: true },
    type: {
        type: String,
        enum: ['EXCEL_EXPORT', 'EMAIL_REPORT', 'NOTIFICATION'],
        required: true
    },
    status: {
        type: String,
        enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'],
        default: 'QUEUED'
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    attempts: { type: Number, default: 0 }
}, { timestamps: true });

asyncJobSchema.index({ type: 1, status: 1, createdAt: -1 });

const AsyncJob = mongoose.model('AsyncJob', asyncJobSchema);
export default AsyncJob;
