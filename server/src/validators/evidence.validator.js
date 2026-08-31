import { z } from 'zod';

export const createEvidenceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').trim(),
  description: z.string().min(5, 'Description must be at least 5 characters').trim(),
  type: z.enum(['document', 'image', 'testimony', 'digital_log', 'physical', 'other']),
  source: z.string().min(2, 'Source must be at least 2 characters').trim(),
  tags: z.union([
    z.array(z.string()),
    z.string().transform((str) => str.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))
  ]).optional().default([]),
  initialCustodyNote: z.string().trim().optional()
});

export const updateEvidenceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').trim().optional(),
  description: z.string().min(5, 'Description must be at least 5 characters').trim().optional(),
  type: z.enum(['document', 'image', 'testimony', 'digital_log', 'physical', 'other']).optional(),
  source: z.string().min(2, 'Source must be at least 2 characters').trim().optional(),
  tags: z.union([
    z.array(z.string()),
    z.string().transform((str) => str.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))
  ]).optional()
});

export const rejectEvidenceSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason must be at least 3 characters').trim()
});

export const custodyActionSchema = z.object({
  action: z.string().min(2, 'Action must be at least 2 characters').trim(),
  note: z.string().trim().optional().default('')
});

export const queryEvidenceSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['document', 'image', 'testimony', 'digital_log', 'physical', 'other']).optional(),
  verificationStatus: z.enum(['unverified', 'pending', 'verified', 'rejected']).optional(),
  tag: z.string().optional(),
  search: z.string().optional()
});
