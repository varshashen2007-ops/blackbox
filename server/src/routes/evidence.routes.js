import { Router } from 'express';
import * as evidenceController from '../controllers/evidence.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { upload } from '../services/fileStorage.service.js';
import {
  createEvidenceSchema,
  updateEvidenceSchema,
  rejectEvidenceSchema,
  custodyActionSchema,
  queryEvidenceSchema
} from '../validators/evidence.validator.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', validate(queryEvidenceSchema, 'query'), evidenceController.listEvidence);

router.post(
  '/',
  requireRole('investigator', 'supervisor'),
  upload.single('file'),
  validate(createEvidenceSchema),
  evidenceController.createEvidence
);

router.get('/:id', evidenceController.getEvidenceById);

router.patch(
  '/:id',
  requireRole('investigator', 'supervisor'),
  validate(updateEvidenceSchema),
  evidenceController.updateEvidence
);

router.post('/:id/request-verification', evidenceController.requestVerification);

router.post(
  '/:id/verify',
  requireRole('supervisor'),
  evidenceController.verifyEvidence
);

router.post(
  '/:id/reject',
  requireRole('supervisor'),
  validate(rejectEvidenceSchema),
  evidenceController.rejectEvidence
);

router.post(
  '/:id/custody',
  requireRole('investigator', 'supervisor'),
  validate(custodyActionSchema),
  evidenceController.appendCustody
);

router.get('/:id/file', evidenceController.downloadFile);

export default router;
