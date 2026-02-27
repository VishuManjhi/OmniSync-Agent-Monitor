import express from 'express';
import * as analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/', analyticsController.getQueueStats);
router.get('/agent/:agentId', analyticsController.getAgentAnalytics);
router.get('/agent/:agentId/report', analyticsController.getAgentReport);
router.get('/agent/:agentId/report/export', analyticsController.exportAgentReport);
router.post('/agent/:agentId/report/export', analyticsController.enqueueAgentReportExport);
router.get('/agent/:agentId/export-report', analyticsController.exportAgentReport);
router.post('/agent/:agentId/report/email', analyticsController.emailAgentReport);
router.post('/notifications', analyticsController.enqueueNotification);
router.get('/jobs/:jobId', analyticsController.getAsyncJobStatus);
router.get('/jobs', analyticsController.listAsyncJobs);
router.get('/sla/breaches', analyticsController.getSlaBreaches);
router.post('/sla/automate', analyticsController.runSlaAutomation);

export default router;
