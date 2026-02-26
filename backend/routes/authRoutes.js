import express from 'express';
import * as authController from '../controllers/authController.js';
import { validate, authSchema } from '../middleware/validation.js';

const router = express.Router();

router.post('/login', validate(authSchema), authController.login);

export default router;
