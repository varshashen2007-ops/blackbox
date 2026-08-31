import { Router } from 'express';
import * as relationshipController from '../controllers/relationship.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { createRelationshipSchema } from '../validators/relationship.validator.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', relationshipController.listRelationships);
router.get('/graph', relationshipController.getGraphData);
router.post(
  '/',
  requireRole('investigator', 'supervisor'),
  validate(createRelationshipSchema),
  relationshipController.createRelationship
);
router.delete(
  '/:id',
  requireRole('investigator', 'supervisor'),
  relationshipController.deleteRelationship
);

export default router;
