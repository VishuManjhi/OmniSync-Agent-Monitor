import express from 'express';
import cors from 'cors';
import { getDb, ObjectId } from '../db.js';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function collection(name) {
  const db = await getDb();
  return db.collection(name);
}

// Agents
app.get('/api/agents', async (req, res) => {
  try {
    const col = await collection('agents');
    const agents = await col.find({}).toArray();
    res.json(agents);
  } catch (err) {
    console.error('[API] GET /api/agents failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const col = await collection('agents');
    const agent = await col.findOne({ agentId });
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
    const session = req.body;
    if (!session || !session.sessionID || !session.agentId) {
      return res.status(400).json({ error: 'INVALID_SESSION' });
    }

    const col = await collection('agent_sessions');

    // Explicitly rebuild updateData to avoid internal fields
    const updateData = {};
    const allowedKeys = ['sessionID', 'agentId', 'clockInTime', 'clockOutTime', 'onCall', 'status', 'breaks', 'lastActivity'];
    allowedKeys.forEach(key => {
      if (session[key] !== undefined) updateData[key] = session[key];
    });

    await col.updateOne(
      { sessionID: session.sessionID },
      { $set: { ...updateData, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
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
    const col = await collection('agent_sessions');
    // Get latest session for each agentId
    const sessions = await col.aggregate([
      { $sort: { updatedAt: -1 } },
      { $group: { _id: '$agentId', latestSession: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$latestSession' } }
    ]).toArray();
    res.json(sessions);
  } catch (err) {
    console.error('[API] GET /api/agent-sessions failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/agents/:agentId/sessions/current', async (req, res) => {
  try {
    const { agentId } = req.params;
    const col = await collection('agent_sessions');
    const sessions = await col
      .find({ agentId })
      .sort({ clockInTime: -1 })
      .limit(1)
      .toArray();

    if (!sessions.length) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    res.json(sessions[0]);
  } catch (err) {
    console.error('[API] GET /api/agents/:agentId/sessions/current failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.post('/api/agents/:agentId/force-logout', async (req, res) => {
  try {
    const { agentId } = req.params;
    const col = await collection('agent_sessions');

    // Find latest active session and mark for logout
    await col.updateOne(
      { agentId, clockOutTime: null },
      { $set: { forceLoggedOut: true, updatedAt: new Date() } }
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
    const ticket = req.body;
    if (!ticket || !ticket.ticketId || !ticket.agentId) {
      return res.status(400).json({ error: 'INVALID_TICKET' });
    }

    const col = await collection('tickets');

    // Explicitly rebuild updateData
    const updateData = {};
    const allowedKeys = ['ticketId', 'agentId', 'issueType', 'description', 'status', 'issueDateTime', 'priority', 'attachments', 'createdBy', 'resolution'];
    allowedKeys.forEach(key => {
      if (ticket[key] !== undefined) updateData[key] = ticket[key];
    });

    await col.updateOne(
      { ticketId: ticket.ticketId },
      { $set: { ...updateData, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
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
    const col = await collection('tickets');
    const tickets = await col.find({ agentId }).sort({ issueDateTime: -1 }).toArray();
    res.json(tickets);
  } catch (err) {
    console.error('[API] GET /api/agents/:agentId/tickets failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/tickets', async (req, res) => {
  try {
    const col = await collection('tickets');
    const tickets = await col.find({}).sort({ issueDateTime: -1 }).toArray();
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

    const col = await collection('tickets');
    const result = await col.updateOne(
      { ticketId },
      { $set: { ...updates, updatedAt: new Date() } }
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
    const col = await collection('tickets');
    const activity = await col.find({ createdBy: supervisorId }).sort({ createdAt: -1 }).toArray();
    res.json(activity);
  } catch (err) {
    console.error('[API] GET /api/supervisors/:supervisorId/activity failed', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Queue stats for header (replaces SSE mock)
app.get('/api/queue-stats', async (req, res) => {
  try {
    const db = await getDb();
    const ticketsCol = db.collection('tickets');
    const sessionsCol = db.collection('agent_sessions');

    const [waitingCalls, activeAgentsResult, slaResolved, totalTickets] = await Promise.all([
      ticketsCol.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'ASSIGNED', 'RESOLUTION_REQUESTED'] } }),
      sessionsCol.distinct('agentId', { clockOutTime: null }),
      ticketsCol.countDocuments({ status: 'RESOLVED' }),
      ticketsCol.countDocuments({})
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

