import { Router } from 'express';
import * as hypothesisController from '../controllers/hypothesis.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  createHypothesisSchema,
  updateHypothesisSchema,
  linkEvidenceSchema
} from '../validators/hypothesis.validator.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', hypothesisController.listHypotheses);
router.post(
  '/',
  requireRole('investigator', 'supervisor'),
  validate(createHypothesisSchema),
  hypothesisController.createHypothesis
);

router.get('/:id', hypothesisController.getHypothesisById);
router.patch(
  '/:id',
  requireRole('investigator', 'supervisor'),
  validate(updateHypothesisSchema),
  hypothesisController.updateHypothesis
);

router.post(
  '/:id/link-evidence',
  requireRole('investigator', 'supervisor'),
  validate(linkEvidenceSchema),
  hypothesisController.linkEvidence
);

router.delete(
  '/:id/unlink-evidence/:evidenceId',
  requireRole('investigator', 'supervisor'),
  hypothesisController.unlinkEvidence
);

export default router;
