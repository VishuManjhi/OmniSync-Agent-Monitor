import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const agentSchema = new mongoose.Schema({
    agentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['agent', 'supervisor'], default: 'agent' },
    password: { type: String }, // Hashed password
    forceLoggedOut: { type: Boolean, default: false }
}, { timestamps: true });

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
