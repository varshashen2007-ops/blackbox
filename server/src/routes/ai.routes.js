import { Router } from 'express';
import * as aiController from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Case-specific AI endpoints (mounted at /api/v1/cases/:caseId/ai)
router.get('/brief', aiController.getCaseBrief);
router.post('/chat', aiController.chatWithAi);
router.post('/review', aiController.triggerAiReview);
router.get('/review', aiController.getLatestReview);

export default router;
