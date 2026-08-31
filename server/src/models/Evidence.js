import mongoose from 'mongoose';

const chainOfCustodyEntrySchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    note: {
      type: String,
      default: '',
      trim: true
    }
  },
  { _id: false }
);

const evidenceSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: [true, 'Case ID is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Evidence title is required'],
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Evidence description is required'],
      trim: true
    },
    type: {
      type: String,
      enum: ['document', 'image', 'testimony', 'digital_log', 'physical', 'other'],
      required: [true, 'Evidence type is required'],
      index: true
    },
    source: {
      type: String,
      required: [true, 'Evidence source is required'],
      trim: true
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CollectedBy user is required']
    },
    collectedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
      required: true,
      index: true
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    },
    chainOfCustody: [chainOfCustodyEntrySchema],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],
    fileRefs: [
      {
        type: String,
        trim: true
      }
    ],
    // Forensic Cryptographic Integrity Fields
    fileHash: {
      type: String,
      trim: true,
      default: null
    },
    hashAlgorithm: {
      type: String,
      default: 'SHA-256'
    },
    hashVerified: {
      type: Boolean,
      default: true
    },
    hashVerifiedAt: {
      type: Date,
      default: Date.now
    },
    fileSizeBytes: {
      type: Number,
      default: 0
    },
    fileMimetype: {
      type: String,
      default: null
    },
    originalFilename: {
      type: String,
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

// Text index for search
evidenceSchema.index({ title: 'text', description: 'text', source: 'text' });
evidenceSchema.index({ tags: 1 });

export const Evidence = mongoose.model('Evidence', evidenceSchema);
