import mongoose from 'mongoose';

const supervisorRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    professionalEmail: {
      type: String,
      required: [true, 'Professional/organization email is required'],
      lowercase: true,
      trim: true
    },
    organization: {
      type: String,
      required: [true, 'Organization or agency name is required'],
      trim: true
    },
    professionalTitle: {
      type: String,
      required: [true, 'Professional role/title is required'],
      trim: true
    },
    reason: {
      type: String,
      required: [true, 'Reason for requesting supervisor authority is required'],
      trim: true
    },
    credentialReference: {
      type: String,
      default: null,
      trim: true
    },
    identityVerifiedAtRequest: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'revoked'],
      default: 'pending',
      required: true,
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewNotes: {
      type: String,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
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

supervisorRequestSchema.index({ userId: 1, status: 1 });

export const SupervisorRequest = mongoose.model('SupervisorRequest', supervisorRequestSchema);
