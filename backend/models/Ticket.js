import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
    attachmentId: { type: String },
    fileName: { type: String },
    type: { type: String },
    size: { type: Number },
    content: { type: String }, // Base64 content (Legacy)
    path: { type: String },    // Disk storage path
}, { _id: false });

const emailReplySchema = new mongoose.Schema({
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    templateKey: { type: String },
    message: { type: String },
    note: { type: String },
    providerMessageId: { type: String },
    at: { type: Number, default: () => Date.now() }
}, { _id: false });

const ticketCollaboratorSchema = new mongoose.Schema({
    agentId: { type: String, required: true },
    role: { type: String, enum: ['primary', 'secondary'], default: 'secondary' },
    joinedAt: { type: Number, default: () => Date.now() },
    invitedBy: { type: String },
    active: { type: Boolean, default: true }
}, { _id: false });

const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true },
    displayId: { type: String },
    agentId: { type: String, required: true },
    issueType: { type: String, required: true },
    description: { type: String },
    status: {
        type: String,
        enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'RESOLUTION_REQUESTED', 'RESOLVED', 'REJECTED'],
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
    },
    collaboration: {
        roomId: { type: String },
        primaryAgentId: { type: String },
        collaborators: { type: [ticketCollaboratorSchema], default: [] },
        lastActivityAt: { type: Number }
    },
    emailMeta: {
        source: { type: String, enum: ['manual', 'inbound_email'], default: 'manual' },
        customerEmail: { type: String },
        customerName: { type: String },
        subject: { type: String },
        providerMessageId: { type: String },
        dedupeKey: { type: String },
        triageLabel: { type: String, enum: ['FOH', 'BOH', 'KIOSK', 'other'] },
        triageBreakdown: {
            scores: {
                FOH: { type: Number, default: 0 },
                BOH: { type: Number, default: 0 },
                KIOSK: { type: Number, default: 0 }
            },
            ranked: { type: [new mongoose.Schema({ label: String, score: Number }, { _id: false })], default: [] },
            matchedTerms: {
                FOH: { type: [new mongoose.Schema({ term: String, weight: Number }, { _id: false })], default: [] },
                BOH: { type: [new mongoose.Schema({ term: String, weight: Number }, { _id: false })], default: [] },
                KIOSK: { type: [new mongoose.Schema({ term: String, weight: Number }, { _id: false })], default: [] }
            }
        },
        sopMatched: { type: Boolean, default: false },
        inboundAt: { type: Number },
        lastOutboundAt: { type: Number },
        replies: { type: [emailReplySchema], default: [] }
    }
}, { timestamps: true });

// ── INDEXES FOR PRODUCTION PERFORMANCE ──
ticketSchema.index({ agentId: 1, issueDateTime: -1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ ticketId: 1 }, { unique: true });
ticketSchema.index({ displayId: 1 }, { unique: true });
ticketSchema.index({ createdBy: 1 });
ticketSchema.index({
    ticketId: 'text',
    displayId: 'text',
    issueType: 'text',
    'emailMeta.subject': 'text',
    'resolution.notes': 'text',
    description: 'text'
}, {
    name: 'ticket_text_search_v1',
    weights: {
        ticketId: 15,
        displayId: 12,
        issueType: 5,
        'emailMeta.subject': 6,
        'resolution.notes': 2,
        description: 3
    }
});

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
