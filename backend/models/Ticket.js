import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
    attachmentId: { type: String },
    fileName: { type: String },
    type: { type: String },
    size: { type: Number },
    content: { type: String }, // Base64 content (Legacy)
    path: { type: String },    // Disk storage path
}, { _id: false });

const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true },
    displayId: { type: String },
    agentId: { type: String, required: true },
    issueType: { type: String, required: true },
    description: { type: String },
    status: {
        type: String,
        enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLUTION_REQUESTED', 'RESOLVED', 'REJECTED'],
        default: 'OPEN'
    },
    issueDateTime: { type: Number, required: true },
    callDuration: { type: Number },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    attachments: [attachmentSchema],
    assignedBy: { type: String, enum: ['SUPERVISOR', 'SYSTEM'] },
    createdBy: { type: String },
    startedAt: { type: Number },
    resolvedAt: { type: Number },
    resolutionRequestedAt: { type: Number },
    resolution: {
        status: { type: String },
        notes: { type: String },
        timestamp: { type: Number }
    }
}, { timestamps: true });

// ── INDEXES FOR PRODUCTION PERFORMANCE ──
ticketSchema.index({ agentId: 1, issueDateTime: -1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ ticketId: 1 }, { unique: true });
ticketSchema.index({ displayId: 1 }, { unique: true });
ticketSchema.index({ createdBy: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
