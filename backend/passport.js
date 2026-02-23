import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import mongoose from 'mongoose';
import Agent from './models/Agent.js';

const JWT_SECRET = process.env.JWT_SECRET || 'omnisync_super_secret_key_2024';

const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: JWT_SECRET,
};

export default (passport) => {
    passport.use(
        new JwtStrategy(options, async (jwt_payload, done) => {
            try {
                const { id, role } = jwt_payload;
                console.log(`[Passport] Verifying ID: ${id}, Role: ${role}`);

                // 1. Check Agent collection
                const agent = await Agent.findOne({ agentId: id });
                if (agent) {
                    console.log(`[Passport] Found agent: ${id}`);
                    return done(null, agent);
                }

                // 2. Check for supervisor fallback or collection
                if (role === 'supervisor') {
                    if (id === 'admin' || id.startsWith('sup')) {
                        console.log(`[Passport] Validating supervisor fallback: ${id}`);
                        return done(null, { agentId: id, role: 'supervisor' });
                    }

                    // Check supervisors collection explicitly
                    const db = mongoose.connection.db;
                    if (db) {
                        const sup = await db.collection('supervisors').findOne({ id });
                        if (sup) {
                            console.log(`[Passport] Found supervisor in collection: ${id}`);
                            return done(null, { agentId: id, role: 'supervisor', name: sup.name });
                        }
                    }
                }

                console.warn(`[Passport] Unauthorized for ID: ${id}`);
                return done(null, false);
            } catch (err) {
                console.error('[Passport] Strategy error:', err);
                return done(err, false);
            }
        })
    );
};
