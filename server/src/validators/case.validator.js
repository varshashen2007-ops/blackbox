import { z } from 'zod';

export const createCaseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').trim(),
  description: z.string().min(5, 'Description must be at least 5 characters').trim(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assignedInvestigators: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID')).optional().default([]),
  assignedSupervisor: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID').optional().nullable()
});

export const updateCaseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').trim().optional(),
  description: z.string().min(5, 'Description must be at least 5 characters').trim().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedInvestigators: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID')).optional(),
  assignedSupervisor: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID').optional().nullable()
});

export const transitionCaseSchema = z.object({
  targetStatus: z.enum(['draft', 'active', 'under_review', 'closed', 'archived']),
  reason: z.string().trim().optional()
});

export const queryCasesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['draft', 'active', 'under_review', 'closed', 'archived']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned: z.string().optional(),
  search: z.string().optional(),
  requiresReview: z.coerce.boolean().optional(),
  filter: z.string().optional()
});
