import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Explicit String _id for UUIDs
    senderId: { type: String, required: true },
    receiverId: { type: String }, // Null for broadcasts
    content: { type: String, required: true },
    type: {
        type: String,
        enum: ['BROADCAST', 'HELP_REQUEST', 'CHAT'],
        default: 'CHAT'
    },
    timestamp: { type: Number, default: Date.now },
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

// ── INDEXES FOR PRODUCTION PERFORMANCE ──
messageSchema.index({ senderId: 1 });
messageSchema.index({ receiverId: 1 });
messageSchema.index({ type: 1 });
messageSchema.index({ timestamp: -1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
