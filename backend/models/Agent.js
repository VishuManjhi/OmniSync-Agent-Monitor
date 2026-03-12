import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const agentSchema = new mongoose.Schema({
    agentId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String },
    role: { type: String, enum: ['agent', 'supervisor'], default: 'agent' },
    password: { type: String }, // Hashed password
    forceLoggedOut: { type: Boolean, default: false },
    assignmentEnabled: { type: Boolean, default: true },
    assignmentWeight: { type: Number, default: 1, min: 0 },
    assignmentSkills: {
        type: [String],
        default: ['FOH', 'BOH', 'KIOSK'],
        validate: {
            validator: (skills) => (skills || []).every((item) => ['FOH', 'BOH', 'KIOSK', 'other'].includes(item)),
            message: 'Invalid assignment skill'
        }
    },
    activeOpenTickets: { type: Number, default: 0, min: 0 },
    lastAssignedAt: { type: Number }
}, { timestamps: true });

// ── INDEXES FOR PRODUCTION PERFORMANCE ──
agentSchema.index({ agentId: 1 }, { unique: true });

// Hash password before saving
agentSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
agentSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

const Agent = mongoose.model('Agent', agentSchema);
export default Agent;
