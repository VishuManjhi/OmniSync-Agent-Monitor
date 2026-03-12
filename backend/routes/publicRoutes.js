import express from 'express';
import * as publicController from '../controllers/publicController.js';
import { validate, publicFeedbackSchema } from '../middleware/validation.js';

const router = express.Router();

router.get('/help-content', publicController.getHelpContent);
router.post('/feedback', validate(publicFeedbackSchema), publicController.submitFeedback);

export default router;
