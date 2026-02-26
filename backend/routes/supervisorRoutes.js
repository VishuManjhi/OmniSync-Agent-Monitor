import express from 'express';
import * as ticketController from '../controllers/ticketController.js';

const router = express.Router();

router.get('/:supervisorId/activity', ticketController.getSupervisorActivity);

export default router;
