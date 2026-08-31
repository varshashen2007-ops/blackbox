import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
  queryUsersSchema,
  queryAuditLogsSchema
} from '../validators/admin.validator.js';

const router = Router();

// All admin routes require admin role
router.use(authenticate, requireRole('admin'));

router.get('/stats', adminController.getStats);
router.get('/users', validate(queryUsersSchema, 'query'), adminController.listUsers);
router.patch('/users/:id/role', validate(updateUserRoleSchema), adminController.updateUserRole);
router.patch('/users/:id/status', validate(updateUserStatusSchema), adminController.updateUserStatus);
router.get('/audit-logs', validate(queryAuditLogsSchema, 'query'), adminController.listAuditLogs);

export default router;
