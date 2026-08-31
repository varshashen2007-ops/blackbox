import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from './errorHandler.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication required: Bearer token missing', 401, 'UNAUTHENTICATED'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new AppError('Authentication required: Token missing', 401, 'UNAUTHENTICATED'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.accessSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Access token has expired', 401, 'TOKEN_EXPIRED'));
      }
      return next(new AppError('Invalid access token', 401, 'UNAUTHENTICATED'));
    }

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return next(new AppError('User not found or deleted', 401, 'UNAUTHENTICATED'));
    }

    if (user.status === 'suspended') {
      return next(new AppError('User account is suspended', 403, 'ACCOUNT_SUSPENDED'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function generateTokens(user) {
  const payload = {
    id: user._id ? user._id.toString() : user.id,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry
  });

  return { accessToken, refreshToken };
}
