import express from 'express';
import * as ticketController from '../controllers/ticketController.js';
import { validate, ticketSchema, ticketUpdateSchema } from '../middleware/validation.js';

const router = express.Router();

router.post('/', validate(ticketSchema), ticketController.createTicket);
router.get('/', ticketController.getAllTickets);
router.patch('/:ticketId', validate(ticketUpdateSchema), ticketController.updateTicket);

export default router;
