import mongoose from 'mongoose';

const publicFeedbackSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, enum: ['general', 'feature', 'bug', 'support'], default: 'general' },
    message: { type: String, required: true, trim: true },
    source: { type: String, default: 'landing_page' }
}, { timestamps: true });

publicFeedbackSchema.index({ createdAt: -1 });
publicFeedbackSchema.index({ email: 1 });

const PublicFeedback = mongoose.model('PublicFeedback', publicFeedbackSchema);
export default PublicFeedback;
