import express from 'express';
import * as agentController from '../controllers/agentController.js';
import { validate, sessionEventSchema } from '../middleware/validation.js';

const router = express.Router();

router.post('/', validate(sessionEventSchema), agentController.updateSession);
router.get('/', agentController.getAllSessions);

export default router;
