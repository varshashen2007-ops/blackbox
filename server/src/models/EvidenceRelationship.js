import mongoose from 'mongoose';

const evidenceRelationshipSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: [true, 'Case ID is required'],
      index: true
    },
    sourceEvidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      required: [true, 'Source evidence ID is required'],
      index: true
    },
    targetEvidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence',
      required: [true, 'Target evidence ID is required'],
      index: true
    },
    relationshipType: {
      type: String,
      enum: ['supports', 'contradicts', 'corroborates', 'references', 'derived_from'],
      required: [true, 'Relationship type is required'],
      index: true
    },
    weight: {
      type: Number,
      min: [0.0, 'Weight cannot be less than 0.0'],
      max: [1.0, 'Weight cannot exceed 1.0'],
      default: 0.5,
      required: true
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy user is required']
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

// Prevent duplicate relationship between identical source, target, and type
evidenceRelationshipSchema.index(
  { caseId: 1, sourceEvidenceId: 1, targetEvidenceId: 1, relationshipType: 1 },
  { unique: true }
);

export const EvidenceRelationship = mongoose.model('EvidenceRelationship', evidenceRelationshipSchema);
