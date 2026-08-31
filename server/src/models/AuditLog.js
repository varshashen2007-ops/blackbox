import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
      index: true
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: ['User', 'Case', 'Evidence', 'EvidenceRelationship', 'Hypothesis', 'Auth'],
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      default: null,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    ipAddress: {
      type: String,
      default: 'unknown'
    }
  },
  {
    timestamps: false,
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

auditLogSchema.index({ caseId: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
