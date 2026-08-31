import { Router } from 'express';
import * as caseController from '../controllers/case.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { requireCaseAccess } from '../middleware/caseAccess.js';
import {
  createCaseSchema,
  updateCaseSchema,
  transitionCaseSchema,
  queryCasesSchema
} from '../validators/case.validator.js';
import evidenceRoutes from './evidence.routes.js';
import hypothesisRoutes from './hypothesis.routes.js';
import relationshipRoutes from './relationship.routes.js';
import aiRoutes from './ai.routes.js';
import reportRoutes from './report.routes.js';

const router = Router();

// All case routes require authentication
router.use(authenticate);

// Assignee lookups for case assignment modal / dropdowns
router.get('/assignees/supervisors', caseController.listEligibleSupervisors);
router.get('/assignees/investigators', caseController.listEligibleInvestigators);

// Sub-resource routers protected with case-level authorization
router.use('/:caseId/evidence', requireCaseAccess, evidenceRoutes);
router.use('/:caseId/hypotheses', requireCaseAccess, hypothesisRoutes);
router.use('/:caseId/relationships', requireCaseAccess, relationshipRoutes);
router.use('/:caseId/ai', requireCaseAccess, aiRoutes);
router.use('/:caseId/report', requireCaseAccess, reportRoutes);

// Base Case Endpoints
router.get('/', validate(queryCasesSchema, 'query'), caseController.getCases);
router.post(
  '/',
  requireRole('investigator', 'supervisor', 'admin'),
  validate(createCaseSchema),
  caseController.createCase
);

router.get('/:id', requireCaseAccess, caseController.getCaseById);
router.patch(
  '/:id',
  requireCaseAccess,
  requireRole('investigator', 'supervisor', 'admin'),
  validate(updateCaseSchema),
  caseController.updateCase
);

router.post(
  '/:id/transition',
  requireCaseAccess,
  validate(transitionCaseSchema),
  caseController.transitionCase
);

router.get('/:id/timeline', requireCaseAccess, caseController.getCaseTimeline);

export default router;
