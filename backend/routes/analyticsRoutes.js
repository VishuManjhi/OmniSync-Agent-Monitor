import express from 'express';
import * as analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/', analyticsController.getQueueStats);
router.get('/agent/:agentId', analyticsController.getAgentAnalytics);
router.get('/agent/:agentId/report', analyticsController.getAgentReport);
router.get('/agent/:agentId/report/export', analyticsController.exportAgentReport);
router.post('/agent/:agentId/report/export', analyticsController.exportAgentReport);
router.get('/agent/:agentId/export-report', analyticsController.exportAgentReport);
router.post('/agent/:agentId/report/email', analyticsController.emailAgentReport);

export default router;
