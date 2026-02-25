import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Explicit String _id for UUIDs
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, index: true }, // Null for broadcasts
    content: { type: String, required: true },
    type: {
        type: String,
        enum: ['BROADCAST', 'HELP_REQUEST', 'CHAT'],
        default: 'CHAT',
        index: true
    },
    timestamp: { type: Number, default: Date.now },
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);
export default Message;
