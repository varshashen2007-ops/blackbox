import mongoose from 'mongoose';

const caseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Case title is required'],
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Case description is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'under_review', 'closed', 'archived'],
      default: 'draft',
      required: true,
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      required: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Case creator is required']
    },
    assignedInvestigators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    assignedSupervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    closedAt: {
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

// Text index for search across title and description
caseSchema.index({ title: 'text', description: 'text' });

export const Case = mongoose.model('Case', caseSchema);
