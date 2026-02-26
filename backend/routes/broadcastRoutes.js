import express from 'express';
import * as analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/', analyticsController.getBroadcasts);

export default router;
