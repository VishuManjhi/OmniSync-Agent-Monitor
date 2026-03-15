import express from 'express';
import * as ticketController from '../controllers/ticketController.js';
import {
	validate,
	ticketSchema,
	ticketUpdateSchema,
	ticketReplySchema,
	topSolutionApplySchema,
	solutionFeedbackSchema,
	ticketCollaboratorAddSchema,
	ticketCollaboratorRemoveSchema
} from '../middleware/validation.js';

const router = express.Router();

router.post('/', validate(ticketSchema), ticketController.createTicket);
router.get('/', ticketController.getAllTickets);
router.patch('/:ticketId', validate(ticketUpdateSchema), ticketController.updateTicket);
router.get('/:ticketId/collaborators', ticketController.listCollaborators);
router.post('/:ticketId/collaborators', validate(ticketCollaboratorAddSchema), ticketController.addCollaborator);
router.delete('/:ticketId/collaborators', validate(ticketCollaboratorRemoveSchema), ticketController.removeCollaborator);
router.post('/:ticketId/send-reply', validate(ticketReplySchema), ticketController.sendReply);
router.get('/:ticketId/top-solutions', ticketController.getTopSolutions);
router.post('/:ticketId/apply-solution', validate(topSolutionApplySchema), ticketController.applyTopSolution);
router.post('/:ticketId/solution-feedback', validate(solutionFeedbackSchema), ticketController.submitAgentSolutionFeedback);

export default router;
