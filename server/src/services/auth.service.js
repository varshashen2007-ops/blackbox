import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateTokens } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { generateMfaSecret, verifyTotpCode, getOtpAuthUri } from './mfa.service.js';

/**
 * Register a new user
 * STRICT RULE: Public registration ALWAYS creates a LEVEL 1 INVESTIGATOR.
 * Any role, securityLevel, or supervisorStatus sent from client is discarded.
 */
export async function registerUser({ name, email, password }, ipAddress = 'unknown') {
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('Email address is already registered', 409, 'CONFLICT');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'investigator', // Enforce investigator role
    status: 'active',
    emailVerified: false,
    identityVerified: false,
    supervisorStatus: 'none',
    mfaEnabled: false
  });

  // Synchronous Audit Log for registration
  await logAudit({
    actorId: user._id,
    action: 'USER_REGISTER',
    entityType: 'User',
    entityId: user._id,
    metadata: {
      role: 'investigator',
      email: user.email,
      assignedLevel: 1
    },
    ipAddress
  });

  const tokens = generateTokens(user);

  return {
    user: user.toJSON(),
    tokens
  };
}

/**
 * Authenticate user credentials
 * Enforces account state checks (suspended / revoked) and MFA challenges for Level 2/3
 */
export async function loginUser({ email, password, mfaCode }, ipAddress = 'unknown') {
  const normalizedEmail = email.toLowerCase().trim();
  // Include mfaSecret explicitly for verification if needed
  const user = await User.findOne({ email: normalizedEmail }).select('+mfaSecret');
  if (!user) {
    await logAudit({
      actorId: null,
      action: 'LOGIN_FAILED',
      entityType: 'Auth',
      entityId: new (await import('mongoose')).default.Types.ObjectId(),
      metadata: { attemptedEmail: normalizedEmail, reason: 'USER_NOT_FOUND' },
      ipAddress
    }).catch(() => {});
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status === 'suspended' || user.status === 'revoked') {
    await logAudit({
      actorId: user._id,
      action: 'LOGIN_FAILED',
      entityType: 'Auth',
      entityId: user._id,
      metadata: { email: user.email, reason: `ACCOUNT_${user.status.toUpperCase()}` },
      ipAddress
    });
    throw new AppError(`Account is ${user.status}. Access denied. Contact an administrator.`, 403, `ACCOUNT_${user.status.toUpperCase()}`);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    await logAudit({
      actorId: user._id,
      action: 'LOGIN_FAILED',
      entityType: 'Auth',
      entityId: user._id,
      metadata: { email: user.email, reason: 'INVALID_PASSWORD' },
      ipAddress
    });
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check if MFA is enabled on account
  if (user.mfaEnabled && user.mfaSecret) {
    if (!mfaCode) {
      // Issue temporary 5-minute MFA challenge token
      const tempToken = jwt.sign(
        { id: user._id.toString(), type: 'mfa_challenge', email: user.email },
        config.jwt.accessSecret,
        { expiresIn: '5m' }
      );

      return {
        mfaRequired: true,
        tempToken,
        message: 'Multi-factor authentication code required to complete login'
      };
    }

    // Direct MFA code verification
    const isMfaValid = verifyTotpCode(mfaCode, user.mfaSecret);
    if (!isMfaValid) {
      await logAudit({
        actorId: user._id,
        action: 'MFA_FAILED',
        entityType: 'Auth',
        entityId: user._id,
        metadata: { email: user.email },
        ipAddress
      });
      throw new AppError('Invalid multi-factor authentication code', 401, 'INVALID_MFA_CODE');
    }

    user.lastMfaVerification = new Date();
  }

  user.lastLoginAt = new Date();
  await user.save();

  // Audit Log for successful login
  await logAudit({
    actorId: user._id,
    action: 'USER_LOGIN',
    entityType: 'Auth',
    entityId: user._id,
    metadata: {
      email: user.email,
      role: user.role,
      securityLevel: user.securityLevel,
      mfaVerified: !!user.mfaEnabled
    },
    ipAddress
  });

  const tokens = generateTokens(user);

  return {
    user: user.toJSON(),
    tokens
  };
}

/**
 * Verify MFA Challenge during multi-step login
 */
export async function verifyMfaLogin({ tempToken, code }, ipAddress = 'unknown') {
  let decoded;
  try {
    decoded = jwt.verify(tempToken, config.jwt.accessSecret);
  } catch (err) {
    throw new AppError('MFA challenge session expired or invalid. Please log in again.', 401, 'EXPIRED_MFA_SESSION');
  }

  if (decoded.type !== 'mfa_challenge') {
    throw new AppError('Invalid challenge token type', 401, 'INVALID_TOKEN');
  }

  const user = await User.findById(decoded.id).select('+mfaSecret');
  if (!user || user.status === 'suspended' || user.status === 'revoked') {
    throw new AppError('User not found or account restricted', 401, 'UNAUTHENTICATED');
  }

  const isMfaValid = verifyTotpCode(code, user.mfaSecret);
  if (!isMfaValid) {
    await logAudit({
      actorId: user._id,
      action: 'MFA_FAILED',
      entityType: 'Auth',
      entityId: user._id,
      metadata: { email: user.email },
      ipAddress
    });
    throw new AppError('Invalid multi-factor authentication code', 401, 'INVALID_MFA_CODE');
  }

  user.lastMfaVerification = new Date();
  user.lastLoginAt = new Date();
  await user.save();

  await logAudit({
    actorId: user._id,
    action: 'LOGIN_SUCCESS',
    entityType: 'Auth',
    entityId: user._id,
    metadata: {
      email: user.email,
      role: user.role,
      securityLevel: user.securityLevel,
      mfaVerified: true
    },
    ipAddress
  });

  const tokens = generateTokens(user);
  return {
    user: user.toJSON(),
    tokens
  };
}

/**
 * Setup TOTP MFA for an authenticated user
 */
export async function setupMfa(user) {
  const secret = generateMfaSecret();
  const otpAuthUri = getOtpAuthUri(user.email, secret);

  // Store secret temporarily on user (mfaEnabled remains false until verified)
  await User.findByIdAndUpdate(user._id, {
    mfaSecret: secret
  });

  return {
    secret,
    otpAuthUri,
    message: 'Scan the QR code or enter the secret key in your authenticator app, then submit a 6-digit verification code to activate MFA.'
  };
}

/**
 * Confirm and activate MFA with a valid verification code
 */
export async function confirmMfa(user, code, ipAddress = 'unknown') {
  const userWithSecret = await User.findById(user._id).select('+mfaSecret');
  if (!userWithSecret || !userWithSecret.mfaSecret) {
    throw new AppError('MFA setup was not initiated. Please start MFA setup first.', 400, 'MFA_NOT_INITIALIZED');
  }

  const isValid = verifyTotpCode(code, userWithSecret.mfaSecret);
  if (!isValid) {
    throw new AppError('Invalid verification code. Please check the time on your authenticator device and try again.', 400, 'INVALID_MFA_CODE');
  }

  userWithSecret.mfaEnabled = true;
  userWithSecret.lastMfaVerification = new Date();
  await userWithSecret.save();

  await logAudit({
    actorId: user._id,
    action: 'MFA_ENABLED',
    entityType: 'User',
    entityId: user._id,
    metadata: { email: user.email },
    ipAddress
  });

  return {
    success: true,
    user: userWithSecret.toJSON(),
    message: 'Multi-factor authentication (TOTP) successfully activated on your BlackBox account.'
  };
}

/**
 * Verify email address for user
 */
export async function verifyUserEmail(user, ipAddress = 'unknown') {
  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    { emailVerified: true },
    { new: true }
  );

  await logAudit({
    actorId: user._id,
    action: 'USER_EMAIL_VERIFIED',
    entityType: 'User',
    entityId: user._id,
    metadata: { email: user.email },
    ipAddress
  });

  return updatedUser.toJSON();
}

export async function refreshToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.refreshSecret);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token', 401, 'UNAUTHENTICATED');
  }

  const user = await User.findById(decoded.id);
  if (!user || user.status === 'suspended' || user.status === 'revoked') {
    throw new AppError('User not found or suspended', 401, 'UNAUTHENTICATED');
  }

  const tokens = generateTokens(user);
  return {
    user: user.toJSON(),
    tokens
  };
}

export async function logoutUser(user, ipAddress = 'unknown') {
  if (user && user._id) {
    await logAudit({
      actorId: user._id,
      action: 'USER_LOGOUT',
      entityType: 'Auth',
      entityId: user._id,
      metadata: { email: user.email },
      ipAddress
    });
  }
  return true;
}
