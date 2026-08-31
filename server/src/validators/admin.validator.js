import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  role: z.enum(['investigator', 'supervisor', 'admin']),
  adminPassword: z.string().optional()
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['pending_verification', 'active', 'suspended', 'revoked']),
  reason: z.string().optional()
});

export const queryUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  role: z.enum(['investigator', 'supervisor', 'admin']).optional(),
  status: z.enum(['pending_verification', 'active', 'suspended', 'revoked']).optional(),
  search: z.string().optional()
});

export const queryAuditLogsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  actorId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  caseId: z.string().optional(),
  securityOnly: z.coerce.boolean().optional()
});
