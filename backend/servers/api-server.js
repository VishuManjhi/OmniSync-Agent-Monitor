import express from 'express';
import cors from 'cors';
import passport from 'passport';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { connectDb } from '../db.js';
import passportConfig from '../passport.js';
import { initRedis } from '../services/redisClient.js';
import { initOramaIndex } from '../services/oramaIndexService.js';

// Route Imports
import authRoutes from '../routes/authRoutes.js';
import agentRoutes from '../routes/agentRoutes.js';
import sessionRoutes from '../routes/sessionRoutes.js';
import ticketRoutes from '../routes/ticketRoutes.js';
import analyticsRoutes from '../routes/analyticsRoutes.js';
import supervisorRoutes from '../routes/supervisorRoutes.js';
import broadcastRoutes from '../routes/broadcastRoutes.js';
import fileRoutes from '../routes/fileRoutes.js';
import webhookRoutes from '../routes/webhookRoutes.js';
import publicRoutes from '../routes/publicRoutes.js';

const app = express();

// Middleware Imports
import errorHandler from '../middleware/errorHandler.js';



// ── ENVIRONMENT VALIDATION ──
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 3003;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] JWT_SECRET is not defined in production environment!');
  process.exit(1);
}

// ── SECURITY MIDDLEWARE ──
// Use Helmet for secure headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow images from uploads to be loaded on frontend
}));

// Standard Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
});

// ── BASIC SETUP ──
// Replace wildcard with specific production origin whitelist
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));

// Apply rate limiter to all API routes (after CORS so preflight always gets CORS headers)
// app.use('/api/', limiter); // Disabled temporarily for local testing

// Prevent HTTP Parameter Pollution
app.use(hpp());
app.use(express.json({
  limit: '5mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
})); // Reduced limit from 10mb for better protection

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploads folder statically
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// ── AUTHENTICATION ──
passportConfig(passport);
app.use(passport.initialize());
const authenticateToken = passport.authenticate('jwt', { session: false });

// ── DATABASE ──
// Initialize Redis (optional) and connect DB
await initRedis().catch(err => {
  console.warn('[API] Redis init failed (continuing without cache):', err);
});

connectDb().catch(err => {
  console.error('[API] Failed to connect to DB:', err);
});

initOramaIndex().then((result) => {
  if (result?.indexed !== null && result?.indexed !== undefined) {
    console.log(`[API] Orama index initialized (${result.indexed} docs)`);
  } else {
    console.log('[API] Orama index ready');
  }
}).catch((err) => {
  console.warn('[API] Orama init failed (continuing with mongo-only top3):', err.message);
});

// ── HEALTH CHECK ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ── PUBLIC ROUTES ──
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/public', publicRoutes);

// ── PROTECTED ROUTES ──
app.use('/api', authenticateToken);
app.use('/api/agents', agentRoutes);
app.use('/api/agent-sessions', sessionRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/queue-stats', analyticsRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/upload', fileRoutes);

// ── GLOBAL ERROR HANDLER ──
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[API] Modular Server listening on http://localhost:${PORT}`);
});
