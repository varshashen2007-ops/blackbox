import { EvidenceRelationship } from '../models/EvidenceRelationship.js';
import { Evidence } from '../models/Evidence.js';
import { Hypothesis } from '../models/Hypothesis.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/audit.js';
import { recomputeAllHypothesesForCase } from './confidenceScore.service.js';

export async function createRelationship({
  caseId,
  sourceEvidenceId,
  targetEvidenceId,
  relationshipType,
  weight = 0.5,
  notes = '',
  user,
  ipAddress = 'unknown'
}) {
  if (sourceEvidenceId === targetEvidenceId) {
    throw new AppError('Evidence item cannot be linked to itself', 400, 'SELF_RELATIONSHIP_NOT_ALLOWED');
  }

  const [sourceEv, targetEv] = await Promise.all([
    Evidence.findOne({ _id: sourceEvidenceId, caseId }),
    Evidence.findOne({ _id: targetEvidenceId, caseId })
  ]);

  if (!sourceEv || !targetEv) {
    throw new AppError('Both source and target evidence must exist in the same case', 404, 'NOT_FOUND');
  }

  // Check for duplicate relationship
  const existing = await EvidenceRelationship.findOne({
    caseId,
    sourceEvidenceId,
    targetEvidenceId,
    relationshipType
  });

  if (existing) {
    throw new AppError('Relationship of this type already exists between these evidence items', 409, 'CONFLICT');
  }

  const relationship = await EvidenceRelationship.create({
    caseId,
    sourceEvidenceId,
    targetEvidenceId,
    relationshipType,
    weight,
    notes,
    createdBy: user._id
  });

  // Recompute confidence scores for all hypotheses in case
  await recomputeAllHypothesesForCase(caseId);

  await logAudit({
    actorId: user._id,
    action: 'RELATIONSHIP_CREATED',
    entityType: 'EvidenceRelationship',
    entityId: relationship._id,
    caseId,
    metadata: {
      sourceEvidenceId,
      targetEvidenceId,
      relationshipType,
      weight
    },
    ipAddress
  });

  const populated = await EvidenceRelationship.findById(relationship._id)
    .populate('sourceEvidenceId', 'title type verificationStatus')
    .populate('targetEvidenceId', 'title type verificationStatus')
    .populate('createdBy', 'name email role');

  return populated;
}

export async function getRelationshipsForCase(caseId) {
  return EvidenceRelationship.find({ caseId })
    .populate('sourceEvidenceId', 'title type verificationStatus')
    .populate('targetEvidenceId', 'title type verificationStatus')
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 });
}

export async function deleteRelationship({ caseId, relationshipId, user, ipAddress = 'unknown' }) {
  const rel = await EvidenceRelationship.findOne({ _id: relationshipId, caseId });
  if (!rel) {
    throw new AppError('Relationship not found', 404, 'NOT_FOUND');
  }

  // Only creator or supervisor can delete
  if (user.role === 'investigator' && rel.createdBy.toString() !== user._id.toString()) {
    throw new AppError('Only the creator or a supervisor can remove this relationship', 403, 'FORBIDDEN');
  }

  await EvidenceRelationship.findByIdAndDelete(relationshipId);

  await recomputeAllHypothesesForCase(caseId);

  await logAudit({
    actorId: user._id,
    action: 'RELATIONSHIP_DELETED',
    entityType: 'EvidenceRelationship',
    entityId: rel._id,
    caseId,
    metadata: {
      sourceEvidenceId: rel.sourceEvidenceId,
      targetEvidenceId: rel.targetEvidenceId,
      relationshipType: rel.relationshipType
    },
    ipAddress
  });

  return { message: 'Relationship deleted successfully' };
}

export async function getCaseGraphData(caseId) {
  const [evidenceList, hypotheses, relationships] = await Promise.all([
    Evidence.find({ caseId }).lean(),
    Hypothesis.find({ caseId }).lean(),
    EvidenceRelationship.find({ caseId }).lean()
  ]);

  const nodes = [
    ...evidenceList.map((e) => ({
      id: e._id.toString(),
      label: e.title,
      nodeType: 'evidence',
      evidenceType: e.type,
      verificationStatus: e.verificationStatus,
      source: e.source
    })),
    ...hypotheses.map((h) => ({
      id: h._id.toString(),
      label: h.title,
      nodeType: 'hypothesis',
      status: h.status,
      confidenceScore: h.confidenceScore
    }))
  ];

  const links = [
    // Evidence-to-Evidence links
    ...relationships.map((r) => ({
      id: r._id.toString(),
      source: r.sourceEvidenceId.toString(),
      target: r.targetEvidenceId.toString(),
      type: r.relationshipType,
      weight: r.weight,
      notes: r.notes,
      category: 'evidence_rel'
    })),
    // Evidence-to-Hypothesis links
    ...hypotheses.flatMap((h) =>
      (h.linkedEvidence || []).map((le, idx) => ({
        id: `${h._id}-${le.evidenceId}-${idx}`,
        source: le.evidenceId.toString(),
        target: h._id.toString(),
        type: le.stance,
        weight: 0.5,
        category: 'hypothesis_stance'
      }))
    )
  ];

  return { nodes, links };
}
