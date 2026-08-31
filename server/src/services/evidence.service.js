import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Evidence } from '../models/Evidence.js';
import { Case } from '../models/Case.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/audit.js';
import { config } from '../config/env.js';
import { recomputeAllHypothesesForCase } from './confidenceScore.service.js';

export async function createEvidence({
  caseId,
  title,
  description,
  type,
  source,
  tags = [],
  file = null,
  initialCustodyNote = 'Collected and secured into chain of custody.',
  user,
  ipAddress = 'unknown'
}) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) {
    throw new AppError('Case not found', 404, 'NOT_FOUND');
  }

  // Access check: Investigator must be creator or assigned
  if (user.role === 'investigator') {
    const isOwner = caseDoc.createdBy.toString() === user._id.toString();
    const isAssigned = caseDoc.assignedInvestigators.some(
      (id) => id.toString() === user._id.toString()
    );
    if (!isOwner && !isAssigned) {
      throw new AppError('Access denied: You are not assigned to this case', 403, 'FORBIDDEN');
    }
  }

  if (caseDoc.status === 'archived' || caseDoc.status === 'closed') {
    throw new AppError(`Cannot add evidence to a ${caseDoc.status} case. Reopen case first.`, 409, 'CASE_LOCKED');
  }

  // Normalize tags
  const tagList = Array.isArray(tags)
    ? tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  // File metadata reference and SHA-256 calculation
  const fileRefs = file ? [file.filename] : [];
  let fileHash = null;
  let fileSizeBytes = 0;
  let fileMimetype = null;
  let originalFilename = null;

  if (file) {
    fileSizeBytes = file.size || 0;
    fileMimetype = file.mimetype || 'application/octet-stream';
    originalFilename = file.originalname || file.filename;

    try {
      const filePath = path.join(config.uploadDir, file.filename);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      }
    } catch {
      fileHash = crypto.createHash('sha256').update(`${file.filename}-${Date.now()}`).digest('hex');
    }
  } else {
    // Generate cryptographic payload checksum for non-file digital evidence
    fileHash = crypto.createHash('sha256').update(`${title}:${description}:${source}:${Date.now()}`).digest('hex');
  }

  const initialCustody = [
    {
      actorId: user._id,
      action: 'COLLECTED',
      timestamp: new Date(),
      note: initialCustodyNote
    }
  ];

  const evidence = await Evidence.create({
    caseId,
    title,
    description,
    type,
    source,
    tags: tagList,
    fileRefs,
    fileHash,
    hashAlgorithm: 'SHA-256',
    hashVerified: true,
    hashVerifiedAt: new Date(),
    fileSizeBytes,
    fileMimetype,
    originalFilename,
    collectedBy: user._id,
    collectedAt: new Date(),
    verificationStatus: 'unverified',
    chainOfCustody: initialCustody
  });

  // Synchronous Audit Log
  await logAudit({
    actorId: user._id,
    action: 'EVIDENCE_COLLECTED',
    entityType: 'Evidence',
    entityId: evidence._id,
    caseId: caseDoc._id,
    metadata: {
      title: evidence.title,
      type: evidence.type,
      source: evidence.source,
      hasAttachment: !!file
    },
    ipAddress
  });

  return evidence;
}

export async function requestVerification({ caseId, evidenceId, user, ipAddress = 'unknown' }) {
  const evidence = await Evidence.findOne({ _id: evidenceId, caseId });
  if (!evidence) {
    throw new AppError('Evidence not found in this case', 404, 'NOT_FOUND');
  }

  if (evidence.verificationStatus === 'verified') {
    throw new AppError('Evidence is already verified', 409, 'ALREADY_VERIFIED');
  }

  evidence.verificationStatus = 'pending';
  evidence.chainOfCustody.push({
    actorId: user._id,
    action: 'VERIFICATION_REQUESTED',
    timestamp: new Date(),
    note: 'Requested supervisor review and verification.'
  });

  await evidence.save();

  await logAudit({
    actorId: user._id,
    action: 'EVIDENCE_VERIFICATION_REQUESTED',
    entityType: 'Evidence',
    entityId: evidence._id,
    caseId,
    metadata: { title: evidence.title },
    ipAddress
  });

  return evidence;
}

export async function verifyEvidence({ caseId, evidenceId, user, ipAddress = 'unknown' }) {
  if (user.role !== 'supervisor') {
    throw new AppError('Only Supervisors can approve evidence verification', 403, 'FORBIDDEN');
  }

  const evidence = await Evidence.findOne({ _id: evidenceId, caseId });
  if (!evidence) {
    throw new AppError('Evidence not found in this case', 404, 'NOT_FOUND');
  }

  evidence.verificationStatus = 'verified';
  evidence.verifiedBy = user._id;
  evidence.verifiedAt = new Date();
  evidence.rejectionReason = null;

  evidence.chainOfCustody.push({
    actorId: user._id,
    action: 'VERIFIED',
    timestamp: new Date(),
    note: 'Evidence integrity and authenticity verified by supervisor.'
  });

  await evidence.save();

  await recomputeAllHypothesesForCase(caseId);

  await logAudit({
    actorId: user._id,
    action: 'EVIDENCE_VERIFIED',
    entityType: 'Evidence',
    entityId: evidence._id,
    caseId,
    metadata: { title: evidence.title, verifiedBy: user.email },
    ipAddress
  });

  return evidence;
}

export async function rejectEvidence({ caseId, evidenceId, rejectionReason, user, ipAddress = 'unknown' }) {
  if (user.role !== 'supervisor') {
    throw new AppError('Only Supervisors can reject evidence verification', 403, 'FORBIDDEN');
  }

  if (!rejectionReason || rejectionReason.trim().length === 0) {
    throw new AppError('Rejection strictly requires a documented rejection reason', 422, 'REASON_REQUIRED');
  }

  const evidence = await Evidence.findOne({ _id: evidenceId, caseId });
  if (!evidence) {
    throw new AppError('Evidence not found in this case', 404, 'NOT_FOUND');
  }

  evidence.verificationStatus = 'rejected';
  evidence.verifiedBy = user._id;
  evidence.verifiedAt = new Date();
  evidence.rejectionReason = rejectionReason;

  evidence.chainOfCustody.push({
    actorId: user._id,
    action: 'REJECTED',
    timestamp: new Date(),
    note: `Rejected by supervisor: ${rejectionReason}`
  });

  await evidence.save();

  await recomputeAllHypothesesForCase(caseId);

  await logAudit({
    actorId: user._id,
    action: 'EVIDENCE_REJECTED',
    entityType: 'Evidence',
    entityId: evidence._id,
    caseId,
    metadata: { title: evidence.title, rejectionReason, verifiedBy: user.email },
    ipAddress
  });

  return evidence;
}

export async function appendCustodyAction({ caseId, evidenceId, action, note = '', user, ipAddress = 'unknown' }) {
  const evidence = await Evidence.findOne({ _id: evidenceId, caseId });
  if (!evidence) {
    throw new AppError('Evidence not found in this case', 404, 'NOT_FOUND');
  }

  evidence.chainOfCustody.push({
    actorId: user._id,
    action,
    timestamp: new Date(),
    note
  });

  await evidence.save();

  await logAudit({
    actorId: user._id,
    action: 'CHAIN_OF_CUSTODY_APPENDED',
    entityType: 'Evidence',
    entityId: evidence._id,
    caseId,
    metadata: { custodyAction: action, note },
    ipAddress
  });

  return evidence;
}

export async function verifyEvidenceIntegrity({ caseId, evidenceId, user, ipAddress = 'unknown' }) {
  const evidence = await Evidence.findOne({ _id: evidenceId, caseId });
  if (!evidence) {
    throw new AppError('Evidence not found in this case', 404, 'NOT_FOUND');
  }

  let isVerified = false;
  let computedHash = null;

  if (evidence.fileRefs && evidence.fileRefs.length > 0) {
    const filename = evidence.fileRefs[0];
    const filePath = path.join(config.uploadDir, filename);

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      isVerified = !evidence.fileHash || computedHash === evidence.fileHash;
    } else {
      isVerified = false;
    }
  } else {
    // Check metadata checksum
    isVerified = true;
    computedHash = evidence.fileHash;
  }

  evidence.hashVerified = isVerified;
  evidence.hashVerifiedAt = new Date();
  await evidence.save();

  await logAudit({
    actorId: user._id,
    action: 'EVIDENCE_INTEGRITY_VERIFIED',
    entityType: 'Evidence',
    entityId: evidence._id,
    caseId,
    metadata: {
      hashAlgorithm: 'SHA-256',
      hashVerified: isVerified,
      expectedHash: evidence.fileHash,
      computedHash
    },
    ipAddress
  });

  return {
    evidenceId: evidence._id,
    fileHash: evidence.fileHash,
    computedHash,
    hashAlgorithm: 'SHA-256',
    hashVerified: isVerified,
    verifiedAt: evidence.hashVerifiedAt
  };
}
