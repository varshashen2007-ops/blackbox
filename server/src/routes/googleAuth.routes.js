import crypto from 'crypto';
import mongoose from 'mongoose';
import { Router } from 'express';
import { User } from '../models/User.js';
import { generateTokens } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { config } from '../config/env.js';

const router = Router();

// In-memory OAuth state store with TTL (production can use Redis/session store)
const pendingOAuthStates = new Map();
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, entry] of pendingOAuthStates) {
    if (now - entry.createdAt > STATE_TTL_MS) {
      pendingOAuthStates.delete(key);
    }
  }
}

/**
 * Helper to safely log unauthenticated OAuth audit events
 */
async function logOAuthAudit(action, metadata, ipAddress) {
  try {
    const fallbackId = new mongoose.Types.ObjectId();
    await logAudit({
      actorId: fallbackId,
      action,
      entityType: 'Auth',
      entityId: fallbackId,
      metadata,
      ipAddress
    });
  } catch (err) {
    console.error(`[OAuth Audit Error] ${action}:`, err.message);
  }
}

/**
 * GET /api/v1/auth/google
 * Initiates server-side OAuth 2.0 authorization-code flow.
 * Generates cryptographic state, redirects browser to Google consent screen.
 */
router.get('/', (req, res) => {
  const { clientId, redirectUri } = config.google;

  if (!clientId || !config.google.clientSecret) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'OAUTH_UNCONFIGURED',
        message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in server .env.'
      }
    });
  }

  // Generate cryptographically secure state
  const state = crypto.randomBytes(32).toString('hex');

  // Store state server-side with timestamp
  cleanExpiredStates();
  pendingOAuthStates.set(state, { createdAt: Date.now(), ip: req.ip });

  // Build Google OAuth authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account'
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.redirect(googleAuthUrl);
});

/**
 * GET /api/v1/auth/google/callback
 * Handles Google OAuth callback. Validates state, exchanges authorization code
 * for tokens, validates Google identity server-side, creates/links BlackBox user.
 */
router.get('/callback', async (req, res) => {
  const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
  const frontendUrl = config.google.frontendUrl;

  try {
    const { code, state, error: oauthError } = req.query;

    // Handle Google OAuth denial
    if (oauthError) {
      await logOAuthAudit('OAUTH_DENIED', { error: oauthError, reason: 'User denied OAuth consent' }, ipAddress);
      return res.redirect(`${frontendUrl}/login?error=oauth_denied`);
    }

    // Validate state parameter exists
    if (!state) {
      await logOAuthAudit('OAUTH_STATE_MISMATCH', { reason: 'Missing state parameter' }, ipAddress);
      return res.redirect(`${frontendUrl}/login?error=oauth_state_missing`);
    }

    // Validate state matches server-side stored state
    const storedState = pendingOAuthStates.get(state);
    pendingOAuthStates.delete(state); // One-time use

    if (!storedState) {
      await logOAuthAudit('OAUTH_STATE_MISMATCH', { reason: 'State not found or expired' }, ipAddress);
      return res.redirect(`${frontendUrl}/login?error=oauth_state_invalid`);
    }

    // Check state TTL
    if (Date.now() - storedState.createdAt > STATE_TTL_MS) {
      await logOAuthAudit('OAUTH_STATE_MISMATCH', { reason: 'State expired' }, ipAddress);
      return res.redirect(`${frontendUrl}/login?error=oauth_state_expired`);
    }

    // Validate authorization code exists
    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=oauth_code_missing`);
    }

    // Exchange authorization code for tokens (server-to-server)
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('[Google OAuth] Token exchange failed:', errBody);
      await logOAuthAudit('OAUTH_TOKEN_EXCHANGE_FAILED', { httpStatus: tokenResponse.status, reason: 'Token exchange failed' }, ipAddress);
      return res.redirect(`${frontendUrl}/login?error=oauth_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const idToken = tokenData.id_token;

    if (!idToken) {
      return res.redirect(`${frontendUrl}/login?error=oauth_no_id_token`);
    }

    // Validate ID token via Google's tokeninfo endpoint (server-side verification)
    const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!tokenInfoResponse.ok) {
      await logOAuthAudit('OAUTH_INVALID_TOKEN', { reason: 'ID token validation failed' }, ipAddress);
      return res.redirect(`${frontendUrl}/login?error=oauth_invalid_token`);
    }

    const googleIdentity = await tokenInfoResponse.json();

    // Validate issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!googleIdentity.iss || !validIssuers.includes(googleIdentity.iss)) {
      await logOAuthAudit('OAUTH_INVALID_ISSUER', { issuer: googleIdentity.iss, reason: 'Invalid issuer' }, ipAddress);
      return res.redirect(`${frontendUrl}/login?error=oauth_invalid_issuer`);
    }

    // Validate audience matches our client ID
    if (googleIdentity.aud !== config.google.clientId) {
      await logOAuthAudit('OAUTH_AUDIENCE_MISMATCH', { expectedAud: config.google.clientId, receivedAud: googleIdentity.aud }, ipAddress);
      return res.redirect(`${frontendUrl}/login?error=oauth_audience_mismatch`);
    }

    // Validate token expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (googleIdentity.exp && parseInt(googleIdentity.exp, 10) < nowSec) {
      await logOAuthAudit('OAUTH_TOKEN_EXPIRED', { exp: googleIdentity.exp, now: nowSec }, ipAddress);
      return res.redirect(`${frontendUrl}/login?error=oauth_token_expired`);
    }

    // Extract verified identity fields from Google (NOT from frontend)
    const verifiedEmail = googleIdentity.email?.toLowerCase().trim();
    const verifiedName = googleIdentity.name || 'Google Verified User';
    const verifiedSub = googleIdentity.sub; // Google's stable subject identifier

    if (!verifiedEmail || !verifiedSub) {
      return res.redirect(`${frontendUrl}/login?error=oauth_incomplete_identity`);
    }

    // Check email verification
    if (googleIdentity.email_verified === 'false' || googleIdentity.email_verified === false) {
      return res.redirect(`${frontendUrl}/login?error=oauth_email_not_verified`);
    }

    // Find existing user by Google Subject ID first (most secure), then by email
    let user = await User.findOne({ googleSubjectId: verifiedSub });

    if (!user) {
      // Try finding by email
      user = await User.findOne({ email: verifiedEmail });

      if (user) {
        // Link Google identity to existing account
        // Only link if the account doesn't already have a different Google subject ID
        if (user.googleSubjectId && user.googleSubjectId !== verifiedSub) {
          await logAudit({
            actorId: user._id,
            action: 'OAUTH_LINKING_CONFLICT',
            entityType: 'User',
            entityId: user._id,
            metadata: { email: verifiedEmail, reason: 'Account already linked to different Google identity' },
            ipAddress
          }).catch(() => {});

          return res.redirect(`${frontendUrl}/login?error=oauth_account_conflict`);
        }

        user.googleSubjectId = verifiedSub;
        user.identityVerified = true;
        user.emailVerified = true;
        user.lastLoginAt = new Date();
        await user.save();

        await logAudit({
          actorId: user._id,
          action: 'OAUTH_ACCOUNT_LINKED',
          entityType: 'User',
          entityId: user._id,
          metadata: { email: verifiedEmail, authMethod: 'google_oauth_authcode' },
          ipAddress
        }).catch(() => {});
      } else {
        // Create new Level 1 Investigator (NEVER Supervisor or Admin via OAuth)
        user = await User.create({
          name: verifiedName,
          email: verifiedEmail,
          passwordHash: 'oauth_managed_account_no_password',
          role: 'investigator',
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
          metadata: { authMethod: 'google_oauth_authcode', role: 'investigator', email: user.email },
          ipAddress
        }).catch(() => {});
      }
    } else {
      // Existing user found by googleSubjectId — update login timestamp
      user.identityVerified = true;
      user.emailVerified = true;
      user.lastLoginAt = new Date();
      await user.save();
    }

    // Check account status
    if (user.status === 'suspended' || user.status === 'revoked') {
      await logAudit({
        actorId: user._id,
        action: 'LOGIN_FAILED',
        entityType: 'Auth',
        entityId: user._id,
        metadata: { email: user.email, reason: `ACCOUNT_${user.status.toUpperCase()}`, authMethod: 'google_oauth_authcode' },
        ipAddress
      }).catch(() => {});

      return res.redirect(`${frontendUrl}/login?error=account_${user.status}`);
    }

    // Generate BlackBox session tokens
    const tokens = generateTokens(user);

    // Audit successful OAuth login
    await logAudit({
      actorId: user._id,
      action: 'USER_LOGIN',
      entityType: 'Auth',
      entityId: user._id,
      metadata: {
        email: user.email,
        role: user.role,
        securityLevel: user.securityLevel,
        authMethod: 'google_oauth_authcode'
      },
      ipAddress
    }).catch(() => {});

    // Redirect to frontend with tokens
    const callbackParams = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });

    res.redirect(`${frontendUrl}/login?oauth_success=true&${callbackParams.toString()}`);
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error.message);
    await logOAuthAudit('OAUTH_CALLBACK_ERROR', { error: error.message }, ipAddress);
    res.redirect(`${frontendUrl}/login?error=oauth_server_error`);
  }
});

// Export state store for testing purposes
export { pendingOAuthStates };
export default router;
