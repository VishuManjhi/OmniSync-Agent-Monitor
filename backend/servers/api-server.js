import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { connectDb } from '../db.js';
import Agent from '../models/Agent.js';
import Session from '../models/Session.js';
import Ticket from '../models/Ticket.js';
import passportConfig from '../passport.js';

const JWT_SECRET = process.env.JWT_SECRET || 'omnisync_super_secret_key_2024';
const JWT_EXPIRES = '8h';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads folder statically
app.use('/uploads', express.static(uploadsDir));

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Initialize Passport
passportConfig(passport);
app.use(passport.initialize());

// Connect to DB
connectDb().catch(err => {
  console.error('[API] Failed to connect to DB:', err);
});

// ── Authentication Protection Middleware ──────────────────────────
const authenticateToken = passport.authenticate('jwt', { session: false });

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Auth ────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { id, password } = req.body || {};
    if (!id || !password) {
      return res.status(400).json({ error: 'MISSING_CREDENTIALS' });
    }

    const normalizedId = id.toLowerCase().trim();
    const agent = await Agent.findOne({ agentId: normalizedId });

    let role = null;
    if (!agent) {
      // Fallback for missing DB user (development default)
      if (normalizedId.startsWith('a') && password === 'agent123') role = 'agent';
      else if ((normalizedId === 'admin' || normalizedId.startsWith('sup')) && password === 'sup123') role = 'supervisor';
    } else {
      // DB user: compare password securely
      const isMatch = await agent.comparePassword(password);
      if (isMatch) {
        role = agent.role;
      } else {
        // Fallback for legacy plain-text password check (auto-hashes on first success)
        if (agent.password === password) {
          role = agent.role;
          // Update to hashed password
          agent.password = password;
          await agent.save();
        } else if (!agent.password) {
          // No password set at all → fall back to config defaults
          if (normalizedId.startsWith('a') && password === 'agent123') role = agent.role || 'agent';
          else if ((normalizedId === 'admin' || normalizedId.startsWith('sup')) && password === 'sup123') role = agent.role || 'supervisor';

          if (role) {
            // Set password for future secure logins
            agent.password = password;
            await agent.save();
          }
        }
      }
    }

    if (!role) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    const token = jwt.sign({ id: normalizedId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, id: normalizedId, role });
  } catch (err) {
    console.error('[API] POST /api/auth/login failed:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', details: err.message });
  }
});

app.use('/api', authenticateToken);

// ── File Upload ────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'NO_FILE_UPLOADED' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      url: fileUrl,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (err) {
    console.error('[API] POST /api/upload failed:', err);
    res.status(500).json({ error: 'UPLOAD_FAILED' });
  }
});

// Agents
app.get('/api/agents', async (req, res) => {
  try {
    const agents = await Agent.find({});
    res.json(agents);
  } catch (err) {
    console.error('[API] GET /api/agents failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await Agent.findOne({ agentId });
    if (!agent) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(agent);
  } catch (err) {
    console.error('[API] GET /api/agents/:agentId failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Agent sessions
app.post('/api/agent-sessions', async (req, res) => {
  try {
    const sessionData = req.body;
    if (!sessionData || !sessionData.sessionID || !sessionData.agentId) {
      return res.status(400).json({ error: 'INVALID_SESSION' });
    }

    await Session.updateOne(
      { sessionID: sessionData.sessionID },
      { $set: sessionData },
      { upsert: true }
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[API] POST /api/agent-sessions failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/agent-sessions', async (req, res) => {
  try {
    const sessions = await Session.aggregate([
      { $sort: { updatedAt: -1 } },
      { $group: { _id: '$agentId', latestSession: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$latestSession' } }
    ]);
    res.json(sessions);
  } catch (err) {
    console.error('[API] GET /api/agent-sessions failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/agents/:agentId/sessions/current', async (req, res) => {
  try {
    const { agentId } = req.params;
    const session = await Session.findOne({ agentId, clockOutTime: null }).sort({ clockInTime: -1 });

    if (!session) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    res.json(session);
  } catch (err) {
    console.error('[API] GET /api/agents/:agentId/sessions/current failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.post('/api/agents/:agentId/force-logout', async (req, res) => {
  try {
    const { agentId } = req.params;
    await Session.updateOne(
      { agentId, clockOutTime: null },
      { $set: { forceLoggedOut: true } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] POST /api/agents/:agentId/force-logout failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Tickets
app.post('/api/tickets', async (req, res) => {
  try {
    const ticketData = req.body;
    if (!ticketData || !ticketData.ticketId || !ticketData.agentId) {
      return res.status(400).json({ error: 'INVALID_TICKET' });
    }

    await Ticket.updateOne(
      { ticketId: ticketData.ticketId },
      { $set: ticketData },
      { upsert: true }
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[API] POST /api/tickets failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/agents/:agentId/tickets', async (req, res) => {
  try {
    const { agentId } = req.params;
    const tickets = await Ticket.find({ agentId }).sort({ issueDateTime: -1 });
    res.json(tickets);
  } catch (err) {
    console.error('[API] GET /api/agents/:agentId/tickets failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find({}).sort({ issueDateTime: -1 });
    res.json(tickets);
  } catch (err) {
    console.error('[API] GET /api/tickets failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.patch('/api/tickets/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const updates = req.body || {};

    const result = await Ticket.updateOne(
      { ticketId },
      { $set: updates }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PATCH /api/tickets/:ticketId failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Supervisors Activity
app.get('/api/supervisors/:supervisorId/activity', async (req, res) => {
  try {
    const { supervisorId } = req.params;
    const activity = await Ticket.find({ createdBy: supervisorId }).sort({ createdAt: -1 });
    res.json(activity);
  } catch (err) {
    console.error('[API] GET /api/supervisors/:supervisorId/activity failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Queue stats
app.get('/api/queue-stats', async (req, res) => {
  try {
    const [waitingCalls, activeAgentsResult, slaResolved, totalTickets] = await Promise.all([
      Ticket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'ASSIGNED', 'RESOLUTION_REQUESTED'] } }),
      Session.distinct('agentId', { clockOutTime: null }),
      Ticket.countDocuments({ status: 'RESOLVED' }),
      Ticket.countDocuments({})
    ]);

    const activeAgents = activeAgentsResult.length;
    const slaPercent = totalTickets ? Math.round((slaResolved / totalTickets) * 100) : 0;

    res.json({
      timestamp: Date.now(),
      queueDepth: waitingCalls,
      waitingCalls,
      activeAgents,
      slaPercent
    });
  } catch (err) {
    console.error('[API] GET /api/queue-stats failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.listen(PORT, () => {
  console.log(`[API] Server listening on http://localhost:${PORT}`);
});

