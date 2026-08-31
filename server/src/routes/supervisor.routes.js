import { Router } from 'express';
import * as supervisorController from '../controllers/supervisor.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  createSupervisorRequestSchema,
  reviewSupervisorRequestSchema,
  revokeSupervisorSchema
} from '../validators/supervisor.validator.js';

const router = Router();

// All routes require authenticated user
router.use(authenticate);

// Investigator endpoints
router.post('/request', validate(createSupervisorRequestSchema), supervisorController.submitRequest);
router.get('/my-request', supervisorController.getMyRequest);

// Admin endpoints for supervisor review
router.get('/admin/requests', requireRole('admin'), supervisorController.listRequests);
router.post(
  '/admin/requests/:id/approve',
  requireRole('admin'),
  validate(reviewSupervisorRequestSchema),
  supervisorController.approveRequest
);
router.post(
  '/admin/requests/:id/reject',
  requireRole('admin'),
  validate(reviewSupervisorRequestSchema),
  supervisorController.rejectRequest
);
router.post(
  '/admin/users/:userId/revoke',
  requireRole('admin'),
  validate(revokeSupervisorSchema),
  supervisorController.revokeSupervisor
);

export default router;
