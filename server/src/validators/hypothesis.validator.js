import { z } from 'zod';

export const createHypothesisSchema = z.object({
  title: z.string().min(3, 'Hypothesis title must be at least 3 characters').trim(),
  description: z.string().min(5, 'Hypothesis description must be at least 5 characters').trim(),
  status: z.enum(['proposed', 'under_investigation', 'supported', 'refuted', 'inconclusive']).default('proposed')
});

export const updateHypothesisSchema = z.object({
  title: z.string().min(3, 'Hypothesis title must be at least 3 characters').trim().optional(),
  description: z.string().min(5, 'Hypothesis description must be at least 5 characters').trim().optional(),
  status: z.enum(['proposed', 'under_investigation', 'supported', 'refuted', 'inconclusive']).optional()
});

export const linkEvidenceSchema = z.object({
  evidenceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid evidence ID'),
  stance: z.enum(['supports', 'contradicts'])
});
