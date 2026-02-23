import mongoose from 'mongoose';

const breakSchema = new mongoose.Schema({
    breakIn: { type: Number, required: true },
    breakOut: { type: Number, default: null },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
    sessionID: { type: String, required: true, unique: true, index: true },
    agentId: { type: String, required: true, index: true },
    clockInTime: { type: Number, required: true },
    clockOutTime: { type: Number, default: null },
    onCall: { type: Boolean, default: false },
    status: { type: String },
    breaks: [breakSchema],
    lastActivity: { type: Number },
    forceLoggedOut: { type: Boolean, default: false },
}, { timestamps: true });

const Session = mongoose.model('Session', sessionSchema);
export default Session;
