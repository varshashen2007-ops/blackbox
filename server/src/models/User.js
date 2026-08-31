import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'User email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    role: {
      type: String,
      enum: ['investigator', 'supervisor', 'admin'],
      default: 'investigator',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending_verification', 'active', 'suspended', 'revoked'],
      default: 'active',
      required: true,
      index: true
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    identityVerified: {
      type: Boolean,
      default: false
    },
    googleSubjectId: {
      type: String,
      default: null,
      sparse: true
    },
    organization: {
      type: String,
      default: null,
      trim: true
    },
    professionalEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true
    },
    professionalEmailVerified: {
      type: Boolean,
      default: false
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    mfaSecret: {
      type: String,
      default: null,
      select: false // never returned in standard queries
    },
    lastMfaVerification: {
      type: Date,
      default: null
    },
    supervisorStatus: {
      type: String,
      enum: ['none', 'pending', 'under_review', 'approved', 'rejected', 'revoked'],
      default: 'none',
      index: true
    },
    supervisorApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    supervisorApprovedAt: {
      type: Date,
      default: null
    },
    adminProvisioned: {
      type: Boolean,
      default: false
    },
    lastLoginAt: {
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
        delete ret.passwordHash;
        delete ret.mfaSecret;
        return ret;
      }
    }
  }
);

// Virtual security level derived from verified conditions (NEVER client-supplied)
userSchema.virtual('securityLevel').get(function () {
  if (this.role === 'admin') return 3; // LEVEL 3: Verified System Administrator
  if (this.role === 'supervisor') return 2; // LEVEL 2: Approved Investigation Supervisor
  if (this.role === 'investigator') {
    if (this.emailVerified || this.identityVerified || this.status === 'active') return 1; // LEVEL 1: Active Investigator
    return 0; // LEVEL 0: Unverified
  }
  return 0;
});

export const User = mongoose.model('User', userSchema);
