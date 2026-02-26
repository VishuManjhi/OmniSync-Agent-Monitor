import mongoose from 'mongoose';

const breakSchema = new mongoose.Schema({
    breakIn: { type: Number, required: true },
    breakOut: { type: Number, default: null },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
    sessionID: { type: String, required: true },
    agentId: { type: String, required: true },
    clockInTime: { type: Number, required: true },
    clockOutTime: { type: Number, default: null },
    onCall: { type: Boolean, default: false },
    onBreak: { type: Boolean, default: false },
    breaks: [breakSchema],
    lastActivity: { type: Number, default: Date.now },
}, { timestamps: true });

const Session = mongoose.model('Session', sessionSchema);

// ── INDEXES FOR PRODUCTION PERFORMANCE ──
sessionSchema.index({ sessionID: 1 }, { unique: true });
sessionSchema.index({ agentId: 1, clockInTime: -1 });
sessionSchema.index({ lastActivity: -1 });

export default Session;
