import { Router } from 'express';
import * as aiController from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/brief', aiController.getCaseBrief);
router.post('/chat', aiController.chatWithAi);

export default router;
