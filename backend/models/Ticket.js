import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
    name: { type: String },
    type: { type: String },
    content: { type: String }, // Base64 content
}, { _id: false });

const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true, index: true },
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
    resolution: {
        status: { type: String },
        notes: { type: String },
        timestamp: { type: Number }
    }
}, { timestamps: true });

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
