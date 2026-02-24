import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
    attachmentId: { type: String },
    fileName: { type: String },
    type: { type: String },
    size: { type: Number },
    content: { type: String }, // Base64 content
}, { _id: false });

const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true, index: true },
    displayId: { type: String, unique: true, index: true },
    agentId: { type: String, required: true, index: true },
    issueType: { type: String, required: true },
    description: { type: String },
    status: {
        type: String,
        enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLUTION_REQUESTED', 'RESOLVED', 'REJECTED'],
        default: 'OPEN'
    },
    issueDateTime: { type: Number, required: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    attachments: [attachmentSchema],
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

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
