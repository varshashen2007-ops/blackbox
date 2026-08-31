import { Router } from 'express';
import * as caseController from '../controllers/case.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  createCaseSchema,
  updateCaseSchema,
  transitionCaseSchema,
  queryCasesSchema
} from '../validators/case.validator.js';
import evidenceRoutes from './evidence.routes.js';
import hypothesisRoutes from './hypothesis.routes.js';
import relationshipRoutes from './relationship.routes.js';

const router = Router();

// Sub-resource routers
router.use('/:caseId/evidence', evidenceRoutes);
router.use('/:caseId/hypotheses', hypothesisRoutes);
router.use('/:caseId/relationships', relationshipRoutes);

// All case routes require authentication
router.use(authenticate);

router.get('/', validate(queryCasesSchema, 'query'), caseController.getCases);
router.post(
  '/',
  requireRole('investigator', 'supervisor', 'admin'),
  validate(createCaseSchema),
  caseController.createCase
);

router.get('/:id', caseController.getCaseById);
router.patch(
  '/:id',
  requireRole('investigator', 'supervisor'),
  validate(updateCaseSchema),
  caseController.updateCase
);

router.post(
  '/:id/transition',
  validate(transitionCaseSchema),
  caseController.transitionCase
);

router.get('/:id/timeline', caseController.getCaseTimeline);

export default router;
