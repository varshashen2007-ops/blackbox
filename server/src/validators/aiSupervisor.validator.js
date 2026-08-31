import { z } from 'zod';

export const evidenceAssessmentSchema = z.object({
  evidenceId: z.string().min(1),
  title: z.string().optional().default(''),
  assessment: z.enum(['SUPPORTING', 'CONTRADICTING', 'NEUTRAL', 'FLAGGED', 'VERIFIED', 'NEEDS_REVIEW']).default('VERIFIED'),
  confidence: z.number().min(0).max(1).default(0.85),
  reason: z.string().min(1),
  integritySignal: z.enum(['STRONG', 'CALCULATED', 'CONCERN', 'NOT_AVAILABLE']).default('CALCULATED')
});

export const hypothesisAssessmentSchema = z.object({
  hypothesisId: z.string().min(1),
  title: z.string().optional().default(''),
  confidence: z.number().min(0).max(100).default(50),
  supportingEvidence: z.array(z.string()).default([]),
  contradictingEvidence: z.array(z.string()).default([]),
  reasoning: z.string().min(1)
});

export const contradictionSchema = z.object({
  sourceEvidenceId: z.string().min(1),
  targetEvidenceId: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM')
});

export const aiSupervisorReviewSchema = z.object({
  caseAssessment: z.object({
    status: z.string().default('REVIEW_COMPLETE'),
    confidence: z.number().min(0).max(1).default(0.8),
    summary: z.string().default('')
  }),
  evidenceAssessments: z.array(evidenceAssessmentSchema).default([]),
  hypothesisAssessments: z.array(hypothesisAssessmentSchema).default([]),
  contradictions: z.array(contradictionSchema).default([]),
  missingEvidence: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  overallAssessment: z.string().min(1),
  confidenceExplanation: z.string().optional().default('')
});

export const runReviewSchema = z.object({
  caseId: z.string().optional()
});
