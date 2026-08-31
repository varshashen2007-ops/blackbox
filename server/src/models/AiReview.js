import mongoose from 'mongoose';

const evidenceAssessmentSchema = new mongoose.Schema(
  {
    evidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    assessment: {
      type: String,
      enum: ['SUPPORTING', 'CONTRADICTING', 'NEUTRAL', 'FLAGGED', 'VERIFIED', 'NEEDS_REVIEW'],
      default: 'VERIFIED'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.85
    },
    reason: {
      type: String,
      required: true
    },
    integritySignal: {
      type: String,
      enum: ['STRONG', 'CALCULATED', 'CONCERN', 'NOT_AVAILABLE'],
      default: 'CALCULATED'
    }
  },
  { _id: false }
);

const hypothesisAssessmentSchema = new mongoose.Schema(
  {
    hypothesisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hypothesis',
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 50.0
    },
    supportingEvidence: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evidence'
      }
    ],
    contradictingEvidence: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evidence'
      }
    ],
    reasoning: {
      type: String,
      required: true
    }
  },
  { _id: false }
);

const contradictionSchema = new mongoose.Schema(
  {
    sourceEvidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      required: true
    },
    targetEvidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      required: true
    },
    description: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    }
  },
  { _id: false }
);

const aiReviewSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: [true, 'Case ID is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'failed'],
      default: 'completed',
      index: true
    },
    decision: {
      type: String,
      enum: ['REVIEW_READY', 'REQUIRES_ATTENTION', 'REVIEW_BLOCKED', 'READY_FOR_CLOSURE', 'REVIEW_COMPLETE'],
      default: 'REVIEW_COMPLETE',
      index: true
    },
    caseAssessment: {
      status: {
        type: String,
        default: 'REVIEW_COMPLETE'
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.8
      },
      summary: {
        type: String,
        default: ''
      }
    },
    evidenceAssessments: [evidenceAssessmentSchema],
    hypothesisAssessments: [hypothesisAssessmentSchema],
    contradictions: [contradictionSchema],
    missingEvidence: [
      {
        type: String,
        trim: true
      }
    ],
    recommendations: [
      {
        type: String,
        trim: true
      }
    ],
    overallAssessment: {
      type: String,
      required: true
    },
    confidenceExplanation: {
      type: String,
      default: ''
    },
    deterministicMetrics: {
      totalEvidence: { type: Number, default: 0 },
      verifiedCount: { type: Number, default: 0 },
      unverifiedCount: { type: Number, default: 0 },
      rejectedCount: { type: Number, default: 0 },
      hypothesisCount: { type: Number, default: 0 },
      leadingHypothesisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hypothesis', default: null },
      leadingConfidence: { type: Number, default: 50.0 },
      conflictCount: { type: Number, default: 0 },
      integrityPassedCount: { type: Number, default: 0 }
    },
    modelProvider: {
      type: String,
      enum: ['groq', 'gemini', 'blackbox-forensic-engine', 'deterministic-engine'],
      default: 'groq'
    },
    modelName: {
      type: String,
      default: 'llama-3.3-70b-versatile'
    },
    reviewVersion: {
      type: Number,
      default: 1
    },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

aiReviewSchema.index({ caseId: 1, createdAt: -1 });

export const AiReview = mongoose.model('AiReview', aiReviewSchema);
