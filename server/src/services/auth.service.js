import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateTokens } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

export async function registerUser({ name, email, password, role = 'investigator' }, ipAddress = 'unknown') {
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError('Email address is already registered', 409, 'CONFLICT');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
    status: 'active'
  });

  // Synchronous Audit Log for registration
  await logAudit({
    actorId: user._id,
    action: 'USER_REGISTER',
    entityType: 'User',
    entityId: user._id,
    metadata: { role: user.role, email: user.email },
    ipAddress
  });

  const tokens = generateTokens(user);

  return {
    user: user.toJSON(),
    tokens
  };
}

export async function loginUser({ email, password }, ipAddress = 'unknown') {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status === 'suspended') {
    throw new AppError('Account is suspended. Contact an administrator.', 403, 'ACCOUNT_SUSPENDED');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();

  // Synchronous Audit Log for login
  await logAudit({
    actorId: user._id,
    action: 'USER_LOGIN',
    entityType: 'Auth',
    entityId: user._id,
    metadata: { email: user.email, role: user.role },
    ipAddress
  });

  const tokens = generateTokens(user);

  return {
    user: user.toJSON(),
    tokens
  };
}

export async function refreshToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.refreshSecret);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token', 401, 'UNAUTHENTICATED');
  }

  const user = await User.findById(decoded.id);
  if (!user || user.status === 'suspended') {
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
