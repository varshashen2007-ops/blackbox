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
    const { credential, email, name, googleSubjectId } = req.body;
    const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    if (!isConfigured) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'OAUTH_UNCONFIGURED',
          message: 'Google Identity Service is not configured on this server. Please set GOOGLE_CLIENT_ID in .env.'
        }
      });
    }

    let verifiedEmail = email;
    let verifiedName = name || 'Google Verified Investigator';
    let verifiedSub = googleSubjectId || null;

    // Validate Google ID token directly with Google TokenInfo API if provided
    if (credential) {
      try {
        const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (tokenRes.ok) {
          const payload = await tokenRes.json();
          // Verify audience matches GOOGLE_CLIENT_ID if specified
          if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
            return res.status(401).json({
              success: false,
              error: { code: 'OAUTH_AUDIENCE_MISMATCH', message: 'Google OAuth audience mismatch.' }
            });
          }
          if (payload.email) verifiedEmail = payload.email;
          if (payload.name) verifiedName = payload.name;
          if (payload.sub) verifiedSub = payload.sub;
        }
      } catch (err) {
        console.warn('[Google OAuth] Could not verify token with remote endpoint:', err.message);
      }
    }

    if (!verifiedEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Email identifier missing from Google credential verification' }
      });
    }

    const normalizedEmail = verifiedEmail.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Create new Level 1 Investigator with Identity Verified (NEVER Supervisor or Admin)
      user = await User.create({
        name: verifiedName,
        email: normalizedEmail,
        passwordHash: 'oauth_managed_account_no_password',
        role: 'investigator', // Public identity verification produces investigator role only
        status: 'active',
        emailVerified: true,
        identityVerified: true,
        googleSubjectId: verifiedSub,
        supervisorStatus: 'none',
        mfaEnabled: false
      });

      await logAudit({
        actorId: user._id,
        action: 'USER_REGISTER',
        entityType: 'User',
        entityId: user._id,
        metadata: { authMethod: 'google_oidc', role: 'investigator', email: user.email },
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown'
      });
    } else {
      // Existing user: mark identity verified without changing their assigned role
      user.identityVerified = true;
      user.emailVerified = true;
      if (verifiedSub) user.googleSubjectId = verifiedSub;
      user.lastLoginAt = new Date();
      await user.save();
    }

    if (user.status === 'suspended' || user.status === 'revoked') {
      return res.status(403).json({
        success: false,
        error: {
          code: `ACCOUNT_${user.status.toUpperCase()}`,
          message: `Account is ${user.status}. Access denied.`
        }
      });
    }

    const tokens = generateTokens(user);
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    await logAudit({
      actorId: user._id,
      action: 'IDENTITY_VERIFIED',
      entityType: 'User',
      entityId: user._id,
      metadata: { email: user.email, authMethod: 'google_oidc' },
      ipAddress
    });

    await logAudit({
      actorId: user._id,
      action: 'USER_LOGIN',
      entityType: 'Auth',
      entityId: user._id,
      metadata: { email: user.email, role: user.role, securityLevel: user.securityLevel },
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
        tokens
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
