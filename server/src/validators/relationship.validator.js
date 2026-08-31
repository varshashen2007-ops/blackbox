import { z } from 'zod';

export const createRelationshipSchema = z.object({
  sourceEvidenceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid source evidence ID'),
  targetEvidenceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid target evidence ID'),
  relationshipType: z.enum(['supports', 'contradicts', 'corroborates', 'references', 'derived_from']),
  weight: z.number().min(0.0).max(1.0).default(0.5),
  notes: z.string().trim().optional().default('')
});
