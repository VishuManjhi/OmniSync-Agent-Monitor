import express from 'express';
import * as agentController from '../controllers/agentController.js';
import * as ticketController from '../controllers/ticketController.js';

const router = express.Router();

router.get('/', agentController.getAllAgents);
router.get('/:agentId', agentController.getAgentById);
router.patch('/:agentId/email', agentController.updateAgentEmail);
router.get('/:agentId/sessions/current', agentController.getCurrentSession);
router.post('/:agentId/force-logout', agentController.forceLogout);

// Maintaining compatibility for agent-specific tickets
router.get('/:agentId/tickets', ticketController.getAgentTickets);

export default router;
