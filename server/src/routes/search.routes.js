import { Router } from 'express';
import { globalSearch } from '../controllers/search.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', globalSearch);

export default router;
