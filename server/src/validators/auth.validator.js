import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters')
  // NOTE: role and securityLevel are strictly ignored/rejected on public registration
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().length(6, 'MFA code must be exactly 6 digits').optional()
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

export const verifyMfaSchema = z.object({
  code: z.string().length(6, 'MFA code must be exactly 6 digits').regex(/^\d{6}$/, 'MFA code must be numeric')
});

export const loginMfaChallengeSchema = z.object({
  tempToken: z.string().min(10, 'Temporary challenge token is required'),
  code: z.string().length(6, 'MFA code must be exactly 6 digits').regex(/^\d{6}$/, 'MFA code must be numeric')
});
