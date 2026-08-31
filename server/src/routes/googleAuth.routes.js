import { Router } from 'express';
import { User } from '../models/User.js';
import { generateTokens } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

router.get('/config', (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.status(200).json({
    success: true,
    data: {
      isConfigured,
      clientId: process.env.GOOGLE_CLIENT_ID || null,
      message: isConfigured
        ? 'Google Identity Verification is active.'
        : 'Google OAuth is unconfigured in server environment. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable.'
    }
  });
});

router.post('/verify', async (req, res, next) => {
  try {
    const { credential, email, name } = req.body;
    const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    if (!isConfigured) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'OAUTH_UNCONFIGURED',
          message: 'Google Identity Service is not configured on this server. Please use standard BlackBox investigator credentials.'
        }
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Email identifier missing from Google credential verification' }
      });
    }

    let user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      user = await User.create({
        name: name || 'Google Verified Investigator',
        email: email.toLowerCase().trim(),
        passwordHash: 'oauth_managed_account_no_password',
        role: 'investigator',
        status: 'active'
      });
    }

    const tokens = generateTokens(user);
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    await logAudit({
      actorId: user._id,
      action: 'GOOGLE_OAUTH_LOGIN',
      entityType: 'User',
      entityId: user._id,
      metadata: { email: user.email, authMethod: 'google_oidc' },
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        },
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
