import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyMfaSchema,
  loginMfaChallengeSchema
} from '../validators/auth.validator.js';

const router = Router();

// Public auth endpoints
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/login/mfa', validate(loginMfaChallengeSchema), authController.verifyMfaChallenge);
router.post('/refresh', validate(refreshSchema), authController.refresh);

// Protected auth endpoints
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);
router.post('/verify-email', authenticate, authController.verifyEmail);
router.post('/mfa/setup', authenticate, authController.setupMfa);
router.post('/mfa/confirm', authenticate, validate(verifyMfaSchema), authController.confirmMfa);

export default router;
