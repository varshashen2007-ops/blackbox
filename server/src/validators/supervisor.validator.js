import { z } from 'zod';

export const createSupervisorRequestSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
  professionalEmail: z.string().email('Valid professional/organization email is required').trim().toLowerCase(),
  organization: z.string().min(2, 'Organization name is required').trim(),
  professionalTitle: z.string().min(2, 'Professional title/role is required').trim(),
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters) for requesting supervisor privileges').trim(),
  credentialReference: z.string().optional().nullable()
});

export const reviewSupervisorRequestSchema = z.object({
  reviewNotes: z.string().optional()
});

export const revokeSupervisorSchema = z.object({
  reason: z.string().min(5, 'A revocation reason is required').trim()
});
