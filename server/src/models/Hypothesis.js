import mongoose from 'mongoose';

const linkedEvidenceEntrySchema = new mongoose.Schema(
  {
    evidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      required: true
    },
    stance: {
      type: String,
      enum: ['supports', 'contradicts'],
      required: true
    }
  },
  { _id: false }
);

const hypothesisSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: [true, 'Case ID is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Hypothesis title is required'],
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Hypothesis description is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['proposed', 'under_investigation', 'supported', 'refuted', 'inconclusive'],
      default: 'proposed',
      required: true,
      index: true
    },
    linkedEvidence: [linkedEvidenceEntrySchema],
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50.0,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy user is required']
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

hypothesisSchema.index({ title: 'text', description: 'text' });

export const Hypothesis = mongoose.model('Hypothesis', hypothesisSchema);
